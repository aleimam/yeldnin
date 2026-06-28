import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { moveItems, itemsInContainerHistory, createItems, itemsProvenance } from "@/lib/items/items-service";
import { statusIndex } from "@/lib/items/items-logic";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import {
  clampLinesToPool,
  nextPurchaseStatus,
  prevPurchaseStatus,
  PURCHASE_STATUSES,
  PURCHASE_ITEM_STATUS,
  isMovableFlag,
  type PurchaseLineInput,
  type PurchaseStatus,
} from "./purchasing-logic";
import { isTripPurchaseEligible } from "@/lib/trips/trip-logic";
import { startTripShippingIfApproved } from "@/lib/trips/trip-service";
import { markPatchDelivered, markPatchReceived } from "@/lib/patches/patch-service";
import { parseTypes } from "@/lib/travelers/travelers-logic";
import { formatBizDate } from "@/lib/format/dates";

export interface PoolRow {
  scope: string;
  productId: number;
  productName: string;
  count: number; // total pending (sum of byType)
  byType: Record<string, number>; // pending split by origin request type
  purchasePrice: number | null; // product's default purchase price (for auto-fill)
}

/** Items still awaiting purchase (REQUESTED, in a REQUEST container), grouped by
 *  (scope, product) and split by the originating request's type. */
export async function pendingPool(scopes: string[]): Promise<PoolRow[]> {
  if (!scopes.length) return [];
  const items = await prisma.item.findMany({
    where: { status: "REQUESTED", containerType: "REQUEST", exceptionFlag: null, scope: { in: scopes } },
    select: { scope: true, productId: true, requestId: true, containerId: true },
  });
  if (!items.length) return [];

  // origin request → type (requestId is the anchor; containerId == request id here)
  const reqIds = [...new Set(items.map((i) => i.requestId ?? i.containerId).filter((x): x is number => x != null))];
  const requests = reqIds.length
    ? await prisma.request.findMany({ where: { id: { in: reqIds } }, select: { id: true, type: true } })
    : [];
  const typeOf = new Map(requests.map((r) => [r.id, r.type]));

  const rows = new Map<string, PoolRow>();
  for (const it of items) {
    const key = `${it.scope}:${it.productId}`;
    let row = rows.get(key);
    if (!row) {
      row = { scope: it.scope, productId: it.productId, productName: "—", count: 0, byType: {}, purchasePrice: null };
      rows.set(key, row);
    }
    row.count += 1;
    const rid = it.requestId ?? it.containerId;
    const type = (rid != null ? typeOf.get(rid) : undefined) ?? "UNKNOWN";
    row.byType[type] = (row.byType[type] ?? 0) + 1;
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, purchasePrice: true } });
  const prodOf = new Map(products.map((p) => [p.id, p]));
  for (const row of rows.values()) {
    const p = prodOf.get(row.productId);
    row.productName = p?.name ?? "—";
    row.purchasePrice = p?.purchasePrice ?? null;
  }

  return [...rows.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}

/** Available REQUESTED units for one scope, by productId (for clamping). */
async function availableInScope(scope: string): Promise<Map<number, number>> {
  const items = await prisma.item.findMany({
    where: { status: "REQUESTED", containerType: "REQUEST", exceptionFlag: null, scope },
    select: { productId: true },
  });
  const m = new Map<number, number>();
  for (const it of items) m.set(it.productId, (m.get(it.productId) ?? 0) + 1);
  return m;
}

export interface CreatePurchaseInput {
  scope: string;
  country: string;
  supplierId?: number | null;
  purchasePrice?: number | null;
  destinationType: string;
  destinationId?: number | null;
  notes?: string | null;
  handlingFee?: number | null;
  handlingFeeCurrency?: string | null;
  lines: PurchaseLineInput[];
}

/** Create a purchase and move the chosen pool items REQUESTED → ORDERED. */
export async function createPurchase(input: CreatePurchaseInput, userId: number) {
  const available = await availableInScope(input.scope);
  const lines = clampLinesToPool(input.lines, available);
  if (!lines.length) throw new Error("Nothing available to purchase.");

  const supplier = input.supplierId
    ? await prisma.supplier.findUnique({ where: { id: input.supplierId }, select: { name: true } })
    : null;
  let destinationName: string | null = null;
  if (input.destinationId && input.destinationType === "HUB") {
    const hub = await prisma.hub.findUnique({ where: { id: input.destinationId }, select: { name: true, country: true } });
    if (hub && hub.country !== input.country) {
      throw new Error("The destination must be in the same country as the purchase.");
    }
    destinationName = hub?.name ?? null;
  } else if (input.destinationId && input.destinationType === "TRIP") {
    const trip = await prisma.trip.findUnique({
      where: { id: input.destinationId },
      select: { traveler: { select: { name: true } }, status: true, lastReceivingDate: true, allowedProductTypes: true, country: true },
    });
    if (!trip || !isTripPurchaseEligible(trip, new Date())) {
      throw new Error("Selected trip is not open for purchases (must be Approved/Started Shipping with a future last-receiving date).");
    }
    if (trip.country !== input.country) {
      throw new Error("The destination must be in the same country as the purchase.");
    }
    // The trip must accept all the product types being purchased to it.
    const allowed = parseTypes(trip.allowedProductTypes) as string[];
    if (allowed.length) {
      const prods = await prisma.product.findMany({ where: { id: { in: lines.map((l) => l.productId) } }, select: { type: true } });
      if (prods.some((p) => !allowed.includes(p.type))) {
        throw new Error("This trip does not accept one or more of these product types.");
      }
    }
    destinationName = `${trip.traveler.name} · ${trip.lastReceivingDate ? formatBizDate(trip.lastReceivingDate) : "—"}`;
  }

  const uid = await nextUid("PUR");
  const purchase = await prisma.purchase.create({
    data: {
      uid,
      scope: input.scope,
      country: input.country,
      supplierId: input.supplierId ?? null,
      supplierName: supplier?.name ?? null,
      purchasePrice: input.purchasePrice ?? null,
      destinationType: input.destinationType,
      destinationId: input.destinationId ?? null,
      destinationName,
      notes: input.notes?.trim() || null,
      handlingFee: input.handlingFee ?? null,
      handlingFeeCurrency: input.handlingFeeCurrency ?? null,
      createdById: userId,
    },
  });

  for (const l of lines) {
    const items = await prisma.item.findMany({
      where: { status: "REQUESTED", containerType: "REQUEST", exceptionFlag: null, scope: input.scope, productId: l.productId },
      take: l.count,
      select: { id: true },
    });
    await moveItems(
      items.map((i) => i.id),
      { status: "ORDERED", containerType: "PURCHASE", containerId: purchase.id, action: "purchase" },
      userId,
    );
  }

  // First purchase to an Approved trip starts its shipping automatically.
  if (input.destinationType === "TRIP" && input.destinationId) {
    await startTripShippingIfApproved(input.destinationId, userId);
  }
  return purchase;
}

export function listPurchases(opts: { scopes: string[] }) {
  return prisma.purchase.findMany({
    where: { archivedAt: null, scope: { in: opts.scopes } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** Paginated + filtered purchases (for the Purchases page). */
export async function listPurchasesPaged(opts: {
  scopes: string[];
  search?: string;
  status?: string;
  skip?: number;
  take?: number;
}) {
  const where = {
    archivedAt: null,
    scope: { in: opts.scopes },
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.search
      ? {
          OR: [
            { uid: { contains: opts.search } },
            { supplierName: { contains: opts.search } },
            { destinationName: { contains: opts.search } },
            { country: { contains: opts.search } },
          ],
        }
      : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.purchase.findMany({ where, orderBy: { createdAt: "desc" }, skip: opts.skip ?? 0, take: opts.take ?? 50 }),
    prisma.purchase.count({ where }),
  ]);
  return { rows, total };
}
export function getPurchase(id: number) {
  return prisma.purchase.findFirst({ where: { id, archivedAt: null } });
}
export function getPurchaseItems(purchaseId: number) {
  return itemsInContainerHistory("PURCHASE", purchaseId);
}
export function listHubsForPicker() {
  return prisma.hub.findMany({
    where: { archivedAt: null, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, country: true },
  });
}

const WEBSITE_INDEX = statusIndex("WEBSITE");

/** True once any unit that passed through this purchase has reached the website. */
export async function purchaseOnWebsite(purchaseId: number): Promise<boolean> {
  const items = await itemsInContainerHistory("PURCHASE", purchaseId);
  return items.some((it) => statusIndex(it.status as ItemStatus) >= WEBSITE_INDEX);
}

/** Purchasing/logistics advance the purchase status forward — until it's on the website. */
export async function advancePurchaseStatus(id: number, userId: number) {
  const purchase = await prisma.purchase.findUnique({ where: { id }, select: { status: true } });
  if (!purchase) return;
  const next = nextPurchaseStatus(purchase.status);
  if (!next || (await purchaseOnWebsite(id))) return;
  await prisma.purchase.update({ where: { id }, data: { status: next, updatedById: userId } });
  // Cascade down the dispatch tree: advancing a purchase advances every patch that
  // came from it, and each patch in turn moves its own items (skipping flagged ones).
  // Items still ORDERED in the purchase (never dispatched) aren't on a patch — they
  // stay put; use "Receive at office" to land those straight to the destination.
  const patches = await prisma.patch.findMany({ where: { purchaseId: id }, select: { id: true, status: true } });
  if (next === "DELIVERED") {
    for (const p of patches) if (p.status === "DISPATCHED") await markPatchDelivered(p.id, userId);
  } else if (next === "RECEIVED") {
    for (const p of patches) if (p.status !== "RECEIVED") await markPatchReceived(p.id, userId);
  }
}

/**
 * Step a purchase's status BACK one level and reverse the cascade: the units that
 * sit at the current level's status move back to the previous level's status (and
 * container), and the purchase's patches follow. Units that have already left the
 * hub (status past HUB) are in the operations pipeline now and are left untouched;
 * pinned (flagged) units are skipped. Reverting all the way to NEW un-dispatches:
 * the units return to the purchase as ORDERED and the emptied patches are archived.
 */
export async function reversePurchaseStatus(id: number, userId: number) {
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase || (await purchaseOnWebsite(id))) return;
  const prev = prevPurchaseStatus(purchase.status);
  if (!prev) return;
  const fromItem = PURCHASE_ITEM_STATUS[purchase.status as PurchaseStatus];
  const toItem = PURCHASE_ITEM_STATUS[prev];

  // Units of this purchase currently at the leaving status, not pinned by a flag.
  // For RECEIVED→DELIVERED (fromItem = HUB) this skips units already past the hub.
  const all = await itemsInContainerHistory("PURCHASE", id);
  const affected = all.filter((it) => it.status === fromItem && isMovableFlag(it.exceptionFlag));

  if (affected.length) {
    const prov = await itemsProvenance(affected.map((i) => i.id));
    // Group by the container the units should land in: back to the purchase when
    // reverting to ORDERED, otherwise back into their own patch (or the purchase
    // for office-received units that never had a patch).
    const groups = new Map<string, { containerType: string | null; containerId: number | null; ids: number[] }>();
    for (const it of affected) {
      const patchId = prov.get(it.id)?.patch?.id ?? null;
      const dest =
        toItem === "ORDERED" || !patchId
          ? { containerType: "PURCHASE", containerId: purchase.id }
          : { containerType: "PATCH", containerId: patchId };
      const key = `${dest.containerType}:${dest.containerId}`;
      const g = groups.get(key) ?? { ...dest, ids: [] };
      g.ids.push(it.id);
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      await moveItems(g.ids, { status: toItem, containerType: g.containerType, containerId: g.containerId, action: "purchase-revert" }, userId);
    }
  }

  // Bring the purchase's patches back in step with the new (lower) status.
  const patches = await prisma.patch.findMany({ where: { purchaseId: id, archivedAt: null }, select: { id: true, deliveredAt: true } });
  for (const p of patches) {
    if (prev === "NEW") {
      await prisma.patch.update({ where: { id: p.id }, data: { archivedAt: new Date(), updatedById: userId } });
    } else if (prev === "DISPATCHED") {
      await prisma.patch.update({ where: { id: p.id }, data: { status: "DISPATCHED", deliveredAt: null, receivedAt: null, updatedById: userId } });
    } else if (prev === "DELIVERED") {
      await prisma.patch.update({ where: { id: p.id }, data: { status: "DELIVERED", deliveredAt: p.deliveredAt ?? new Date(), receivedAt: null, updatedById: userId } });
    }
  }

  await prisma.purchase.update({ where: { id }, data: { status: prev, updatedById: userId } });
}

/**
 * Move a purchase to an adjacent status (one step forward or back) with its full
 * cascade. Forward into DISPATCHED is rejected — dispatching needs a real patch
 * (use Dispatch). Callers confirm with the operator first (the cascade is shown).
 */
export async function setPurchaseStatus(id: number, target: string, userId: number) {
  const purchase = await prisma.purchase.findUnique({ where: { id }, select: { status: true } });
  if (!purchase) return;
  const ci = (PURCHASE_STATUSES as readonly string[]).indexOf(purchase.status);
  const ti = (PURCHASE_STATUSES as readonly string[]).indexOf(target);
  if (ci < 0 || ti < 0 || Math.abs(ti - ci) !== 1) return; // single adjacent step only
  if (ti > ci) {
    if (purchase.status === "NEW") return; // forward into DISPATCHED needs a dispatch
    await advancePurchaseStatus(id, userId);
  } else {
    await reversePurchaseStatus(id, userId);
  }
}

/** Bypass patches: receive the purchase's ordered units straight to the destination hub/trip. */
export async function receivePurchaseAtOffice(id: number, userId: number) {
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase || (await purchaseOnWebsite(id))) return;
  const items = await prisma.item.findMany({
    where: { status: "ORDERED", containerType: "PURCHASE", containerId: id, exceptionFlag: null },
    select: { id: true },
  });
  if (items.length) {
    await moveItems(
      items.map((i) => i.id),
      { status: "HUB", containerType: purchase.destinationType, containerId: purchase.destinationId, action: "received-no-patch" },
      userId,
    );
  }
  await prisma.purchase.update({ where: { id }, data: { status: "RECEIVED", updatedById: userId } });
}

export interface UpdatePurchaseInput {
  country: string;
  supplierId?: number | null;
  purchasePrice?: number | null;
  notes?: string | null;
  handlingFee?: number | null;
  handlingFeeCurrency?: string | null;
}

/** Edit a purchase's metadata — allowed only until any unit reaches the website. */
export async function updatePurchase(id: number, input: UpdatePurchaseInput, userId: number) {
  const purchase = await prisma.purchase.findUnique({ where: { id } });
  if (!purchase || (await purchaseOnWebsite(id))) return;
  // The (possibly changed) country must still match the fixed destination's country.
  if (purchase.destinationId) {
    const destCountry =
      purchase.destinationType === "HUB"
        ? (await prisma.hub.findUnique({ where: { id: purchase.destinationId }, select: { country: true } }))?.country
        : (await prisma.trip.findUnique({ where: { id: purchase.destinationId }, select: { country: true } }))?.country;
    if (destCountry && destCountry !== input.country) {
      throw new Error("The destination must be in the same country as the purchase.");
    }
  }
  const supplier = input.supplierId
    ? await prisma.supplier.findUnique({ where: { id: input.supplierId }, select: { name: true } })
    : null;
  await prisma.purchase.update({
    where: { id },
    data: {
      country: input.country,
      supplierId: input.supplierId ?? null,
      supplierName: supplier?.name ?? null,
      purchasePrice: input.purchasePrice ?? null,
      notes: input.notes?.trim() || null,
      handlingFee: input.handlingFee ?? null,
      handlingFeeCurrency: input.handlingFeeCurrency ?? null,
      updatedById: userId,
    },
  });
}

/** Add free gift units (no value) received from a supplier to a purchase — until on website. */
export async function addGiftItems(purchaseId: number, productId: number, count: number, userId: number) {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || (await purchaseOnWebsite(purchaseId))) return;
  await createItems({
    productId,
    scope: purchase.scope,
    count: Math.max(1, Math.floor(count)),
    containerType: "PURCHASE",
    containerId: purchaseId,
    status: "ORDERED",
    isGift: true,
    purchasePrice: 0,
    userId,
  });
}
