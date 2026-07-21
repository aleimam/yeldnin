import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { isTerminal } from "@/lib/deliveries/deliveries-logic";
import { sendLocalizedToUsers } from "@/lib/notify/notify-service";
import { parseDeliveryCreated, parseDeliveryCancel } from "@/lib/integration/delivery-wire";

/**
 * Inbound Deliveries channel (Veeey → YeldnIN), contract v2 §2.1/§2.2.
 *
 *  - `handleDeliveryCreated` upserts a delivery keyed by (storeKey, orderNumber).
 *  - `handleDeliveryCancel` cancels one the CUSTOMER asked to cancel.
 *
 * Both write DIRECTLY; there is no echo path back to Veeey here (tracking §2.3
 * is a separate outbound piece). Scope is stamped VEEEY unconditionally — the
 * wire never carries a scope, because deliveries exist only for the VEEEY line.
 */

export interface DeliveryCreatedResult {
  ok: boolean;
  uid?: string;
  status?: string;
  created?: boolean;
  skipped?: string;
}

export async function handleDeliveryCreated(payload: unknown): Promise<DeliveryCreatedResult> {
  const parsed = parseDeliveryCreated(payload);
  if (!parsed.ok) return { ok: false, skipped: parsed.code };
  const w = parsed.value;

  // Idempotent on (storeKey, orderNumber): a re-fired `created` returns the
  // EXISTING delivery untouched. Overwriting would clobber a delivery Ops has
  // since assigned or taken out — the create event is a one-time birth, not an
  // update channel.
  const existing = await prisma.delivery.findUnique({
    where: { storeKey_orderNumber: { storeKey: w.storeKey, orderNumber: w.orderNumber } },
    select: { uid: true, status: true },
  });
  if (existing) return { ok: true, uid: existing.uid, status: existing.status, created: false };

  const uid = await nextUid("DLV");
  await prisma.delivery.create({
    data: {
      uid,
      storeKey: w.storeKey,
      orderNumber: w.orderNumber,
      scope: "VEEEY", // hardcoded — deliveries are a VEEEY-only concept
      status: "NEW", // no courier yet; YeldnIN Ops assign (§1)
      placedAt: w.placedAt ? new Date(w.placedAt) : null,
      customerName: w.customerName,
      customerPhone: w.customerPhone,
      customerAltPhone: w.customerAltPhone,
      addressZone: w.addressZone,
      addressSubArea: w.addressSubArea,
      addressText: w.addressText,
      addressMapUrl: w.addressMapUrl,
      collectPiastres: w.collectPiastres,
      paymentMethod: w.paymentMethod,
      promisedDate: w.promisedDate ? new Date(w.promisedDate) : null,
      promisedSlot: w.promisedSlot,
      notes: w.notes,
      lines: { create: w.lines.map((l) => ({ sku: l.sku, name: l.name, qty: l.qty })) },
      events: { create: { status: "NEW", note: "created from Veeey" } },
    },
  });
  return { ok: true, uid, status: "NEW", created: true };
}

export interface DeliveryCancelResult {
  ok: boolean;
  uid?: string;
  status?: string;
  /** Set on 409: the caller returns this so Veeey can reconcile. */
  conflict?: { status: string; at: string | null };
  skipped?: string;
}

export async function handleDeliveryCancel(payload: unknown): Promise<DeliveryCancelResult> {
  const parsed = parseDeliveryCancel(payload);
  if (!parsed.ok) return { ok: false, skipped: parsed.code };
  const w = parsed.value;

  const d = await prisma.delivery.findUnique({
    where: { storeKey_orderNumber: { storeKey: w.storeKey, orderNumber: w.orderNumber } },
    select: { id: true, uid: true, status: true, closedAt: true, courierId: true, courier: { select: { userId: true } } },
  });
  if (!d) return { ok: false, skipped: "delivery_not_found" };

  // Already cancelled → idempotent success (a retried cancel is not an error).
  if (d.status === "CANCELLED") return { ok: true, uid: d.uid, status: "CANCELLED" };

  // A delivery that has already closed the other two ways can't be un-closed by
  // the customer — a courier who handed over goods (DELIVERED) or exhausted the
  // attempts (FAILED) is done. Return the current state so Veeey reconciles.
  if (isTerminal(d.status)) {
    return { ok: false, skipped: "already_closed", conflict: { status: d.status, at: d.closedAt?.toISOString() ?? null } };
  }

  const at = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.delivery.update({
      where: { id: d.id },
      data: { status: "CANCELLED", cancelReason: w.reason, closedAt: at, failureReason: null },
    });
    await tx.deliveryEvent.create({ data: { deliveryId: d.id, status: "CANCELLED", at, reason: w.reason, note: "cancelled by customer (Veeey)" } });
  });

  // Notify the assigned courier, best-effort — never let a push failure fail the
  // cancel. A courier out on a route needs to know not to knock.
  if (d.courier?.userId) {
    try {
      await sendLocalizedToUsers([d.courier.userId], (t) => ({
        title: t("dlv.push.cancelledTitle"),
        body: t("dlv.push.cancelledBody").replace("{order}", w.orderNumber),
        url: `/deliveries/${d.id}`,
      }));
    } catch {
      /* best-effort */
    }
  }
  return { ok: true, uid: d.uid, status: "CANCELLED" };
}
