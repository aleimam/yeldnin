import "server-only";
import { prisma } from "@/lib/db";
import { assetUrl } from "@/lib/assets/assets-service";
import { requestToWire, parseWireRequest } from "@/lib/integration/request-wire";
import { integrationEnabled } from "@/lib/integration/config";
import { recordOutbox } from "@/lib/integration/integration-service";

/**
 * Request-specific DB glue for the Veeey sync (Requests epic Phase D):
 *  - `emitRequestSync` (OUTBOUND) loads a request in wire shape and queues it.
 *  - `handleRequestUpsert` (INBOUND) upserts a request that arrived from Veeey.
 *
 * The inbound path writes DIRECTLY and never calls `emitRequestSync` — that one
 * rule is what stops a synced request from echoing straight back to Veeey.
 */

// ── Outbound ───────────────────────────────────────────────────────────────

/**
 * Best-effort: load the request in wire shape and enqueue a `request.upsert`.
 * NEVER throws (so it can't break the write it trails) and early-returns when the
 * integration is disabled — so a request write costs at most one flag read while
 * the integration is off. Call it AFTER the request write commits.
 */
export async function emitRequestSync(requestId: number): Promise<void> {
  try {
    if (!(await integrationEnabled())) return;
    const r = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        customer: { select: { name: true, contactNumber: true } },
        lines: { include: { product: { select: { sku: true, name: true } } } },
        photos: { select: { assetId: true } },
      },
    });
    if (!r) return;
    const wire = requestToWire({
      uid: r.uid,
      type: r.type,
      status: r.status,
      scope: r.scope,
      notes: r.notes,
      deposit: r.deposit,
      archivedAt: r.archivedAt,
      customer: r.customer ? { name: r.customer.name, contactNumber: r.customer.contactNumber } : null,
      lines: r.lines.map((l) => ({
        count: l.count,
        sellingPrice: l.sellingPrice,
        notes: l.notes,
        sku: l.product?.sku ?? null,
        productName: l.product?.name ?? "",
      })),
      // Assets are served at /api/asset/<id> (auth-gated). Veeey keeps only http(s)/
      // /uploads photo URLs on its side, so cross-store photo transfer is a known gap
      // until an asset-export step exists — harmless while the integration is off.
      photoUrls: r.photos.map((p) => assetUrl(p.assetId)).filter((u): u is string => !!u),
    });
    await recordOutbox("request.upsert", wire.uid || null, wire);
  } catch {
    // best-effort — the sync must never break the request write it follows
  }
}

// ── Inbound ────────────────────────────────────────────────────────────────

export interface RequestUpsertResult {
  ok: boolean;
  uid?: string;
  created?: boolean;
  unmatchedLines?: number;
  skipped?: string;
}

/**
 * A request created/updated on Veeey lands here. Upsert the YeldnIN `Request` by
 * its shared `uid`, matching lines to local products by SKU (unknown SKUs are
 * dropped and counted; if none match we skip rather than store an empty request).
 *
 * Writes DIRECTLY (never via emitRequestSync) to avoid an echo loop, and creates
 * new requests with the SUPPLIED uid (never nextUid — the uid is the correlation
 * key and must be preserved). Status is mirrored verbatim; no workflow side
 * effects (item spawning on approval) run — this reflects the record, it does not
 * drive the YeldnIN pipeline. Customer name/phone is informational only: Veeey's
 * customer id is foreign to YeldnIN, so `customerId` is left null.
 */
export async function handleRequestUpsert(payload: unknown): Promise<RequestUpsertResult> {
  const wire = parseWireRequest(payload);
  if (!wire) return { ok: false, skipped: "invalid" };

  const skus = wire.lines.map((l) => l.sku).filter((s): s is string => !!s);
  const products = skus.length ? await prisma.product.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true } }) : [];
  const bySku = new Map(products.map((p) => [p.sku, p.id] as const));
  const lineCreates = wire.lines
    .map((l) => {
      const pid = l.sku ? bySku.get(l.sku) : undefined;
      if (!pid) return null;
      return { productId: pid, count: l.quantity, sellingPrice: l.sellingPriceEgp, notes: l.notes };
    })
    .filter((l): l is NonNullable<typeof l> => l != null);
  const unmatchedLines = wire.lines.length - lineCreates.length;
  if (!lineCreates.length) return { ok: false, uid: wire.uid, unmatchedLines, skipped: "no_known_products" };

  // RequestPhoto.assetId has no FK, so we stash the incoming URL there verbatim
  // (mirrors Veeey storing { url }); rendering remote photos is out of scope.
  const photoCreates = wire.photoUrls.filter((u) => /^(https?:\/\/|\/)/.test(u)).slice(0, 6).map((assetId) => ({ assetId }));
  const base = {
    type: wire.type,
    status: wire.status,
    scope: wire.scope,
    notes: wire.notes,
    deposit: wire.depositEgp,
    archivedAt: wire.archived ? new Date() : null,
    customerId: null as number | null,
  };

  const existing = await prisma.request.findUnique({ where: { uid: wire.uid }, select: { id: true } });
  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.requestLine.deleteMany({ where: { requestId: existing.id } });
      await tx.requestPhoto.deleteMany({ where: { requestId: existing.id } });
      await tx.request.update({ where: { id: existing.id }, data: { ...base, lines: { create: lineCreates }, photos: { create: photoCreates } } });
    });
    return { ok: true, uid: wire.uid, created: false, unmatchedLines };
  }
  await prisma.request.create({ data: { uid: wire.uid, ...base, lines: { create: lineCreates }, photos: { create: photoCreates } } });
  return { ok: true, uid: wire.uid, created: true, unmatchedLines };
}
