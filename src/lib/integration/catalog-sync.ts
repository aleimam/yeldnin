import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { parseProductWire } from "@/lib/integration/catalog-wire";

/**
 * Catalog-specific DB glue for the Veeey sync (catalog sync channel). Veeey is the
 * catalog MASTER; this side only INBOUND-upserts what Veeey pushes. There is no
 * outbound catalog emission — YeldnIN never echoes catalog changes back — so this
 * file holds only `handleCatalogUpsert`, which writes DIRECTLY.
 *
 * The two catalogs are the SAME Egypt-Vitamins products keyed differently: Veeey
 * sends the WordPress id as `wpId`; YeldnIN's `Product.sku` currently stores that
 * same id as a string. We link on the stable `veeeyWpId` column, falling back — on
 * the FIRST push only — to the WP-id-in-sku so an existing product adopts the link
 * instead of duplicating.
 */

export interface CatalogUpsertResult {
  ok: boolean;
  created?: boolean;
  productId?: number;
  wpId?: number;
  skipped?: string;
}

export async function handleCatalogUpsert(payload: unknown): Promise<CatalogUpsertResult> {
  const wire = parseProductWire(payload);
  if (!wire) return { ok: false, skipped: "invalid" };

  // Match: by the stable veeeyWpId link first; else (first-time link) by the
  // current WP-id-in-sku (YeldnIN.Product.sku holds the WordPress id today).
  let existing = await prisma.product.findUnique({ where: { veeeyWpId: wire.wpId }, select: { id: true, sku: true } });
  if (!existing) {
    existing = await prisma.product.findFirst({ where: { sku: String(wire.wpId) }, select: { id: true, sku: true } });
  }

  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        veeeyWpId: wire.wpId,
        sku: wire.sku ?? existing.sku,
        name: wire.name,
        type: wire.type,
        active: wire.active,
      },
    });
    return { ok: true, created: false, productId: existing.id, wpId: wire.wpId };
  }

  // First-time create: Product.uid is String? @unique — generate it like the seed /
  // products-service create path does, so a synced product carries a PRD uid too.
  const uid = await nextUid("PRD");
  const created = await prisma.product.create({
    data: {
      uid,
      veeeyWpId: wire.wpId,
      sku: wire.sku ?? String(wire.wpId),
      name: wire.name,
      type: wire.type,
      scope: "VEEEY",
      active: wire.active,
    },
    select: { id: true },
  });
  return { ok: true, created: true, productId: created.id, wpId: wire.wpId };
}
