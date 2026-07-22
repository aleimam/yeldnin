import "server-only";
import { prisma } from "@/lib/db";
import { integrationEnabled } from "@/lib/integration/config";
import { recordOutbox } from "@/lib/integration/integration-service";
import { buildShipmentWire, parseShipmentReview, type ShipmentUnit } from "@/lib/integration/shipment-wire";
import { moveItems } from "@/lib/items/items-service";

/**
 * Outbound Incoming-Shipments channel (YeldnIN → Veeey), `shipment.received`.
 *
 * Fired when Ops mark a shipment **WEBSITE** ("In Website"). It only REPORTS
 * what arrived — Veeey's Sales still review the expiry dates against the photos
 * and approve, and that approval is what creates sellable stock. So this is
 * safe to emit even if nobody acts on it.
 *
 * Best-effort like `emitDeliveryTracking`: the stock move must never fail
 * because the outbox did.
 */
export async function emitShipmentReceived(shipmentId: number, at: Date): Promise<void> {
  try {
    if (!(await integrationEnabled())) return;
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, uid: true, scope: true },
    });
    if (!shipment) return;
    // Deliveries/stock-in are a VEEEY-line concept; never leak another scope's
    // goods across the integration.
    if (shipment.scope !== "VEEEY") return;

    const items = await prisma.item.findMany({
      where: { containerType: "SHIPMENT", containerId: shipmentId, exceptionFlag: null },
      select: {
        productId: true,
        expiryDate: true,
        lotCode: true,
        purchasePrice: true,
        purchaseCurrency: true,
        product: { select: { sku: true, veeeyWpId: true, name: true } },
      },
    });
    if (!items.length) return;

    const units: ShipmentUnit[] = items.map((i) => ({
      productId: i.productId,
      sku: i.product?.sku ?? null,
      veeeyWpId: i.product?.veeeyWpId ?? null,
      productName: i.product?.name ?? "",
      expiryDate: i.expiryDate,
      lotCode: i.lotCode,
      purchasePrice: i.purchasePrice,
      purchaseCurrency: i.purchaseCurrency,
    }));

    const photos = await prisma.shipmentPhoto.findMany({
      where: { shipmentId },
      orderBy: { id: "asc" },
      select: { assetId: true },
    });

    const wire = buildShipmentWire(shipment, units, photos.map((p) => p.assetId), at);
    await recordOutbox("shipment.received", wire.shipmentUid ?? String(wire.shipmentId), wire);
  } catch {
    // best-effort — reporting the arrival must never block the arrival
  }
}

/**
 * Sales decided HERE rather than in Veeey (owner decision — the review section is
 * mirrored in both apps). Applies the verdict locally and EMITS it, because
 * Veeey is where an approval turns into sellable stock and it cannot know
 * otherwise.
 *
 * The mirror of `handleShipmentReview`, which applies a verdict that arrived
 * from Veeey and deliberately does not emit — only the side where a human
 * clicked announces the decision, or the two would ping-pong it forever.
 */
export async function reviewShipmentLocally(
  shipmentId: number,
  decision: "APPROVED" | "REJECTED",
  reason: string | null,
  userId: number | null,
): Promise<ShipmentReviewResult> {
  const sh = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true, uid: true, status: true, scope: true },
  });
  if (!sh) return { ok: false, skipped: "shipment_not_found" };
  if (sh.scope !== "VEEEY") return { ok: false, skipped: "scope_mismatch" };
  // Only a shipment that has actually been reported to Veeey can be reviewed —
  // approving one still sitting in the office would stock goods Veeey has never
  // been told about.
  if (sh.status !== "WEBSITE") return { ok: false, skipped: "not_under_review" };
  if (decision === "REJECTED" && !reason?.trim()) return { ok: false, skipped: "reason_required" };

  const at = new Date();
  const why = reason?.trim().slice(0, 500) ?? null;
  const reopened = decision === "REJECTED";

  // Predicated on WEBSITE: if Veeey's verdict landed in the meantime, that one
  // stands and this is a no-op rather than a second, conflicting decision.
  const claim = await prisma.shipment.updateMany({
    where: { id: sh.id, status: "WEBSITE" },
    data: {
      reviewStatus: decision,
      reviewNote: why,
      reviewedAt: at,
      ...(reopened ? { status: "PHOTOS_SENT" } : {}),
    },
  });
  if (claim.count === 0) return { ok: false, skipped: "not_under_review" };

  if (reopened) {
    const items = await prisma.item.findMany({
      where: { containerType: "SHIPMENT", containerId: sh.id, exceptionFlag: null },
      select: { id: true },
    });
    if (items.length) await moveItems(items.map((i) => i.id), { status: "PHOTOS_SENT", action: "reviewRejected" }, userId);
  }

  if (sh.uid && (await integrationEnabled())) {
    await recordOutbox("shipment.review", sh.uid, {
      shipmentUid: sh.uid,
      decision,
      reason: why,
      reviewedAt: at.toISOString(),
    });
  }
  return { ok: true, uid: sh.uid ?? undefined, status: reopened ? "PHOTOS_SENT" : "WEBSITE", reopened };
}

export interface ShipmentReviewResult {
  ok: boolean;
  uid?: string;
  status?: string;
  reopened?: boolean;
  skipped?: string;
}

/**
 * Inbound: Veeey Sales decided on a stock-in.
 *
 * REJECTED reopens the shipment at **PHOTOS_SENT** with the reason attached, so
 * Ops correct the expiry/photos and mark it In Website again — the owner's
 * "bounce to Ops to correct" loop. APPROVED is recorded for visibility and
 * leaves the shipment at WEBSITE; it must NOT move anything, because the goods
 * are already counted as stock here.
 *
 * Only a WEBSITE shipment can be reviewed: a verdict on one Ops has since pulled
 * back would otherwise silently overwrite their state.
 */
export async function handleShipmentReview(payload: unknown): Promise<ShipmentReviewResult> {
  const w = parseShipmentReview(payload);
  if (!w) return { ok: false, skipped: "validation_failed" };

  const sh = await prisma.shipment.findUnique({
    where: { uid: w.shipmentUid },
    select: { id: true, uid: true, status: true, scope: true },
  });
  if (!sh) return { ok: false, skipped: "shipment_not_found" };
  if (sh.scope !== "VEEEY") return { ok: false, skipped: "scope_mismatch" };
  if (sh.status !== "WEBSITE") return { ok: false, skipped: "not_under_review" };

  const reopened = w.decision === "REJECTED";
  // Predicated on WEBSITE, like the local path: now that Sales can decide in
  // EITHER app, a verdict from Veeey can race one entered here. First one wins;
  // the loser is a no-op rather than a second, conflicting decision.
  const claim = await prisma.shipment.updateMany({
    where: { id: sh.id, status: "WEBSITE" },
    data: {
      reviewStatus: w.decision,
      reviewNote: w.reason,
      reviewedAt: new Date(w.reviewedAt),
      ...(reopened ? { status: "PHOTOS_SENT" } : {}),
    },
  });
  if (claim.count === 0) return { ok: false, skipped: "not_under_review" };
  // Items follow the shipment back so the two can't disagree about where the
  // goods are in the workflow.
  if (reopened) {
    const items = await prisma.item.findMany({
      where: { containerType: "SHIPMENT", containerId: sh.id, exceptionFlag: null },
      select: { id: true },
    });
    if (items.length) await moveItems(items.map((i) => i.id), { status: "PHOTOS_SENT", action: "reviewRejected" }, null);
  }
  return { ok: true, uid: sh.uid ?? undefined, status: reopened ? "PHOTOS_SENT" : "WEBSITE", reopened };
}
