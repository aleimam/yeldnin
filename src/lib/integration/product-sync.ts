import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { parseProductWireV2, resolveSyncedType } from "@/lib/integration/product-wire";

/**
 * Product-upsert DB glue for the NEW Veeey (contract v2 §1). Writes DIRECTLY —
 * inbound only, no outbound catalog echo. Writes ONLY the Veeey-owned display
 * fields (name, sku, base type, size, grade, photos); the YeldnIN-owned
 * supply-chain fields (purchase price, supplier, origin, url, note, weight,
 * heavy) are never touched, so a resync can't clobber Purchasing's data.
 */

export interface ProductUpsertResult {
  ok: boolean;
  productId?: number;
  sku?: string;
  created?: boolean;
  adoptedFromWpId?: boolean;
  skipped?: string; // error code when !ok
}

export async function handleProductUpsertV2(payload: unknown): Promise<ProductUpsertResult> {
  const w = parseProductWireV2(payload);
  if (!w) return { ok: false, skipped: "validation_failed" };

  // Match: by sku (canonical) → else by legacyWpId (one-time adoption) → else create.
  let existing = await prisma.product.findUnique({ where: { sku: w.sku }, select: { id: true, scope: true, type: true } });
  let adopted = false;
  if (!existing && w.legacyWpId != null) {
    const byWp = await prisma.product.findUnique({ where: { veeeyWpId: w.legacyWpId }, select: { id: true, scope: true, type: true } });
    if (byWp) {
      existing = byWp;
      adopted = true;
    }
  }

  // Scope guard: the sync may only ever touch a VEEEY-scope product.
  if (existing && existing.scope !== "VEEEY") return { ok: false, skipped: "product_scope_mismatch" };

  // Veeey-owned fields only (never the YeldnIN-owned supply-chain columns).
  const displayData = {
    sku: w.sku,
    name: w.name,
    type: resolveSyncedType(w.type, existing?.type ?? null), // heavy never downgrades
    size: w.size,
    grade: w.grade,
    ...(w.archived ? { archivedAt: new Date(), active: false } : {}),
    ...(w.legacyWpId != null ? { veeeyWpId: w.legacyWpId } : {}),
  };

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: existing!.id }, data: displayData });
      // Photos replace-all (Veeey-hotlinked URLs stored verbatim in assetId).
      await tx.productPhoto.deleteMany({ where: { productId: existing!.id } });
      if (w.photoUrls.length) await tx.productPhoto.createMany({ data: w.photoUrls.map((assetId) => ({ productId: existing!.id, assetId })) });
    });
    return { ok: true, productId: existing.id, sku: w.sku, created: false, adoptedFromWpId: adopted };
  }

  // First-time create. New VEEEY products are born in Veeey; YeldnIN mints the uid.
  const uid = await nextUid("PRD");
  const created = await prisma.product.create({
    data: {
      uid,
      scope: "VEEEY",
      ...displayData,
      type: w.type, // no existing row → base type as-is
      photos: w.photoUrls.length ? { create: w.photoUrls.map((assetId) => ({ assetId })) } : undefined,
    },
    select: { id: true },
  });
  return { ok: true, productId: created.id, sku: w.sku, created: true, adoptedFromWpId: false };
}
