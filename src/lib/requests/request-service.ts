import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";
import { createItems } from "@/lib/items/items-service";
import { stageTally, type ProductStage } from "@/lib/items/items-logic";
import { createCustomer } from "@/lib/customers/customers-service";
import { getSla } from "@/lib/sla/sla-config-service";
import { graceDays, sourceClass, promisedDate } from "@/lib/sla/sla-logic";
import { usesApprovalGate, requestLinesEditable } from "./request-logic";
import { sendLocalizedCustomNotification } from "@/lib/notify/notify-message-service";
import { moduleOperatorIds } from "@/lib/notify/notify-service";
import { getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";

export interface CreateRequestInput {
  type: string;
  scope: string;
  customerId?: number | null;
  newCustomer?: { name: string; contactNumber?: string | null } | null;
  notes?: string | null;
  deposit?: number | null;
  lines: { productId: number; count: number; sellingPrice?: number | null; purchasePrice?: number | null; purchaseCurrency?: string | null; notes?: string | null }[];
}
/** Create a request + its lines, then spawn one Item per unit at REQUESTED. */
export async function createRequest(input: CreateRequestInput, photoAssetIds: string[], userId: number) {
  let customerId = input.customerId ?? null;
  if (!customerId && input.newCustomer?.name?.trim()) {
    const c = await createCustomer(
      { name: input.newCustomer.name, scope: input.scope, contactChannel: "WHATSAPP", contactNumber: input.newCustomer.contactNumber ?? null },
      userId,
    );
    customerId = c.id;
  }
  const lines = input.lines.filter((l) => l.productId && l.count >= 1).map((l) => ({ ...l, count: Math.floor(l.count) }));
  const uid = await nextUid("REQ");
  const gated = usesApprovalGate(input.scope);
  const request = await prisma.request.create({
    data: {
      uid,
      type: input.type,
      scope: input.scope,
      // EGV waits for approval before items spawn; XOONX is created already-approved.
      status: gated ? "PENDING" : "APPROVED",
      approvedById: gated ? null : userId,
      approvedAt: gated ? null : new Date(),
      customerId,
      notes: clean(input.notes),
      deposit: input.deposit ?? null,
      createdById: userId,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          count: l.count,
          sellingPrice: l.sellingPrice ?? null,
          purchasePrice: l.purchasePrice ?? null,
          purchaseCurrency: l.purchaseCurrency ?? null,
          notes: clean(l.notes),
        })),
      },
      photos: photoAssetIds.length ? { create: photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
    },
  });
  // Items spawn immediately only when there's no gate (XOONX). EGV items spawn on
  // approval (see approveRequest); flag the approvers that one is waiting.
  if (!gated) {
    await spawnRequestItems(request.id, userId);
    await notifyXoonxRequestNeedsSourcing(request, userId);
  } else {
    await notifyRequestPending(request, userId);
  }
  return request;
}

/**
 * Spawn one Item per requested unit (at REQUESTED) from a request's lines.
 * Idempotent: no-op if the request already has items. Special orders snapshot
 * each item's delivery promise (now + scope/source grace) at spawn time.
 */
async function spawnRequestItems(requestId: number, userId: number) {
  const request = await prisma.request.findUnique({ where: { id: requestId }, include: { lines: true } });
  if (!request) return;
  if ((await prisma.item.count({ where: { requestId } })) > 0) return;
  const lines = request.lines;
  const isSpecial = request.type === "SPECIAL_ORDER";
  const promisedByProduct = new Map<number, Date>();
  if (isSpecial) {
    const [sla, prods] = await Promise.all([
      getSla(),
      prisma.product.findMany({
        where: { id: { in: lines.map((l) => l.productId) } },
        select: { id: true, type: true, defaultSupplier: { select: { slaClass: true } } },
      }),
    ]);
    const now = new Date();
    for (const p of prods) {
      const grace = graceDays(request.scope, sourceClass(p.type, p.defaultSupplier?.slaClass ?? null), sla);
      promisedByProduct.set(p.id, promisedDate(now, grace));
    }
  }
  for (const l of lines) {
    await createItems({
      productId: l.productId,
      scope: request.scope,
      count: l.count,
      requestId: request.id,
      isSpecialOrder: isSpecial,
      promisedDeliveryAt: isSpecial ? promisedByProduct.get(l.productId) ?? null : null,
      sellingPrice: l.sellingPrice ?? null,
      purchasePrice: l.purchasePrice ?? null,
      purchaseCurrency: l.purchaseCurrency ?? null,
      containerType: "REQUEST",
      containerId: request.id,
      status: "REQUESTED",
      userId,
    });
  }
}

export interface RequestActorRef {
  id: number;
  uid: string | null;
  scope: string;
  status: string;
  createdById: number | null;
}
const ACTOR_REF_SELECT = { id: true, uid: true, scope: true, status: true, createdById: true } as const;

/** Tell the EGV approvers (order_requests MANAGE + admins) a request awaits review. */
async function notifyRequestPending(req: RequestActorRef, actorId: number) {
  if (req.scope !== "EGV") return;
  const approvers = await moduleOperatorIds(["order_requests"], "MANAGE");
  await sendLocalizedCustomNotification(approvers, "req.notif.pendingTitle", "req.notif.pendingBody", { ref: req.uid ?? `#${req.id}` }, `/requests/${req.id}`, "info", actorId).catch(() => {});
}

/** Tell the XOONX managers a new (or re-edited) XOONX order needs sourcing —
 *  XOONX orders are born approved and spawn purchasable items immediately, so
 *  without this nobody is told to go buy them. Mirrors the EGV pending notify. */
async function notifyXoonxRequestNeedsSourcing(req: RequestActorRef, actorId: number) {
  if (req.scope !== "XOONX") return;
  const managers = await moduleOperatorIds(["xoonx"], "MANAGE");
  await sendLocalizedCustomNotification(managers, "req.notif.xoonxNewTitle", "req.notif.xoonxNewBody", { ref: req.uid ?? `#${req.id}` }, `/requests/${req.id}`, "info", actorId).catch(() => {});
}

/** Tell the request's creator that it was approved / rejected. */
async function notifyRequestDecision(req: RequestActorRef, approved: boolean, actorId: number) {
  if (!req.createdById) return;
  await sendLocalizedCustomNotification(
    [req.createdById],
    approved ? "req.notif.approvedTitle" : "req.notif.rejectedTitle",
    approved ? "req.notif.approvedBody" : "req.notif.rejectedBody",
    { ref: req.uid ?? `#${req.id}` },
    `/requests/${req.id}`,
    approved ? "success" : "warning",
    actorId,
  ).catch(() => {});
}

/** Approve a PENDING request → spawn its items into the pool. No-op otherwise. */
export async function approveRequest(id: number, userId: number): Promise<RequestActorRef> {
  const req = await prisma.request.findUnique({ where: { id }, select: ACTOR_REF_SELECT });
  if (!req) throw new Error("Request not found.");
  if (req.status === "PENDING") {
    await prisma.request.update({
      where: { id },
      data: { status: "APPROVED", approvedById: userId, approvedAt: new Date(), rejectedNote: null, updatedById: userId },
    });
    await spawnRequestItems(id, userId);
    await notifyRequestDecision(req, true, userId);
  }
  return req;
}

/** Reject a PENDING request (optional reason). No items are spawned. */
export async function rejectRequest(id: number, note: string | null, userId: number): Promise<RequestActorRef> {
  const req = await prisma.request.findUnique({ where: { id }, select: ACTOR_REF_SELECT });
  if (!req) throw new Error("Request not found.");
  if (req.status === "PENDING") {
    await prisma.request.update({ where: { id }, data: { status: "REJECTED", rejectedNote: note?.trim() || null, updatedById: userId } });
    await notifyRequestDecision(req, false, userId);
  }
  return req;
}

/**
 * Edit a request's lines/details. Blocked once any spawned item has progressed
 * past REQUESTED. For EGV this resets the request to PENDING (re-approval) and
 * un-spawns its (still-REQUESTED) items; XOONX re-spawns immediately. Returns
 * whether the request now needs (re-)approval.
 */
export async function updateRequest(
  id: number,
  input: CreateRequestInput,
  photoAssetIds: string[],
  userId: number,
): Promise<{ id: number; needsApproval: boolean }> {
  const req = await prisma.request.findFirst({ where: { id, archivedAt: null }, select: { id: true, uid: true, scope: true, createdById: true, deliveredAt: true } });
  if (!req) throw new Error("Request not found.");
  // A delivered XOONX order has already booked its revenue into that month (and
  // the month may be closed). Editing its prices would silently re-book — block
  // it; the delivery must be un-marked first (only possible in an open month).
  if (req.deliveredAt) {
    throw new Error("This order is delivered and its revenue is booked — un-mark delivery before editing it.");
  }
  const items = await prisma.item.findMany({ where: { requestId: id }, select: { id: true, status: true } });
  if (!requestLinesEditable(items.map((i) => i.status))) {
    throw new Error("This request is already being purchased and can no longer be edited.");
  }
  const gated = usesApprovalGate(req.scope);
  let customerId = input.customerId ?? null;
  if (!customerId && input.newCustomer?.name?.trim()) {
    const c = await createCustomer(
      { name: input.newCustomer.name, scope: req.scope, contactChannel: "WHATSAPP", contactNumber: input.newCustomer.contactNumber ?? null },
      userId,
    );
    customerId = c.id;
  }
  const lines = input.lines.filter((l) => l.productId && l.count >= 1).map((l) => ({ ...l, count: Math.floor(l.count) }));
  const itemIds = items.map((i) => i.id);
  await prisma.$transaction(async (tx) => {
    if (itemIds.length) {
      await tx.itemEvent.deleteMany({ where: { itemId: { in: itemIds } } });
      await tx.item.deleteMany({ where: { id: { in: itemIds } } });
    }
    await tx.requestLine.deleteMany({ where: { requestId: id } });
    await tx.requestPhoto.deleteMany({ where: { requestId: id } });
    await tx.request.update({
      where: { id },
      data: {
        type: input.type,
        customerId,
        notes: clean(input.notes),
        deposit: input.deposit ?? null,
        updatedById: userId,
        // EGV: any edit sends the request back to the approval queue.
        status: gated ? "PENDING" : "APPROVED",
        approvedById: gated ? null : userId,
        approvedAt: gated ? null : new Date(),
        rejectedNote: null,
        lines: {
          create: lines.map((l) => ({
            productId: l.productId,
            count: l.count,
            sellingPrice: l.sellingPrice ?? null,
            purchasePrice: l.purchasePrice ?? null,
            purchaseCurrency: l.purchaseCurrency ?? null,
            notes: clean(l.notes),
          })),
        },
        photos: photoAssetIds.length ? { create: photoAssetIds.map((assetId) => ({ assetId })) } : undefined,
      },
    });
  });
  if (!gated) {
    await spawnRequestItems(id, userId);
    // An edited XOONX order changes what needs buying — re-flag the managers.
    await notifyXoonxRequestNeedsSourcing({ id: req.id, uid: req.uid, scope: req.scope, status: "APPROVED", createdById: req.createdById }, userId);
  } else {
    await notifyRequestPending({ id: req.id, uid: req.uid, scope: req.scope, status: "PENDING", createdById: req.createdById }, userId);
  }
  return { id, needsApproval: gated };
}

/** PENDING requests in scope — feeds the approvers' "awaiting approval" cue. */
export function countPendingRequests(scopes: string[]): Promise<number> {
  return prisma.request.count({ where: { archivedAt: null, status: "PENDING", scope: { in: scopes } } });
}

export function listRequests(opts: { scopes: string[] }) {
  return prisma.request.findMany({
    where: { archivedAt: null, scope: { in: opts.scopes } },
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { name: true } }, _count: { select: { lines: true } } },
    take: 200,
  });
}

export type RequestSortKey = "created" | "customer" | "type" | "status" | "scope";
const REQUEST_ORDER_BY: Record<RequestSortKey, (dir: "asc" | "desc") => object> = {
  created: (dir) => ({ createdAt: dir }),
  customer: (dir) => ({ customer: { name: dir } }),
  type: (dir) => ({ type: dir }),
  status: (dir) => ({ status: dir }),
  scope: (dir) => ({ scope: dir }),
};

/** Paginated + filtered + sortable requests (for the Requests page). Each row
 *  carries its creator + its request lines (product + count) for the popup. */
/**
 * Request ids that are FULFILLED — they have items and every item reached the
 * WEBSITE terminal state. (No Item→Request relation exists, so derive it from the
 * items table: requests seen with a website item but never with a non-website one.)
 */
async function fulfilledRequestIds(scopes: string[]): Promise<number[]> {
  const [withWebsite, withOpen] = await Promise.all([
    prisma.item.findMany({ where: { requestId: { not: null }, scope: { in: scopes }, status: "WEBSITE" }, select: { requestId: true }, distinct: ["requestId"] }),
    prisma.item.findMany({ where: { requestId: { not: null }, scope: { in: scopes }, status: { not: "WEBSITE" } }, select: { requestId: true }, distinct: ["requestId"] }),
  ]);
  const open = new Set(withOpen.map((x) => x.requestId!));
  return withWebsite.map((x) => x.requestId!).filter((id) => !open.has(id));
}

export async function listRequestsPaged(opts: {
  scopes: string[];
  search?: string;
  type?: string;
  status?: string;
  onlyUnfulfilled?: boolean;
  sort?: RequestSortKey;
  dir?: "asc" | "desc";
  skip?: number;
  take?: number;
}) {
  // Unfulfilled = NOT fulfilled (covers requests with no items yet, too).
  const notIn = opts.onlyUnfulfilled ? await fulfilledRequestIds(opts.scopes) : null;
  const where = {
    archivedAt: null,
    scope: { in: opts.scopes },
    ...(opts.type ? { type: opts.type } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(notIn ? { id: { notIn } } : {}),
    ...(opts.search
      ? { OR: [{ uid: { contains: opts.search } }, { customer: { name: { contains: opts.search } } }] }
      : {}),
  };
  const orderBy = REQUEST_ORDER_BY[opts.sort ?? "created"](opts.dir ?? "desc");
  const [rows, total] = await prisma.$transaction([
    prisma.request.findMany({
      where,
      orderBy,
      include: {
        customer: { select: { name: true } },
        _count: { select: { lines: true } },
        lines: { select: { count: true, product: { select: { name: true } } } },
      },
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
    }),
    prisma.request.count({ where }),
  ]);
  return { rows, total };
}

/** Display names for request creators (localized), keyed by userId. */
export async function requestCreatorNames(ids: (number | null | undefined)[]): Promise<Map<number, string>> {
  const clean = [...new Set(ids.filter((x): x is number => typeof x === "number"))];
  if (!clean.length) return new Map();
  const [locale, users] = await Promise.all([
    getLocale(),
    prisma.user.findMany({ where: { id: { in: clean } }, select: { id: true, name: true, nameAr: true } }),
  ]);
  return new Map(users.map((u) => [u.id, displayName(u, locale)]));
}

export interface RequestPoolRow {
  scope: string;
  productId: number;
  productName: string;
  stages: Record<ProductStage, number>; // journey-stage tally (Requested … Problems)
  total: number; // all units ever requested for this product (in scope)
  outstanding: number; // units not yet on the website (i.e. not fulfilled)
}
/**
 * Per-product request pool: for every product that's been requested in scope, the
 * journey-stage breakdown of its requested units (same stages as the product page)
 * plus how many are still outstanding (not on the website). `onlyUnfulfilled`
 * keeps just the products that still have outstanding units.
 */
export async function requestPool(
  scopes: string[],
  opts: { search?: string; onlyUnfulfilled?: boolean } = {},
): Promise<RequestPoolRow[]> {
  if (!scopes.length) return [];
  const items = await prisma.item.findMany({
    where: { requestId: { not: null }, scope: { in: scopes } },
    select: { productId: true, scope: true, status: true, exceptionFlag: true },
  });
  const grouped = new Map<string, { scope: string; productId: number; items: { status: string; exceptionFlag: string | null }[] }>();
  for (const it of items) {
    const key = `${it.scope}:${it.productId}`;
    let g = grouped.get(key);
    if (!g) { g = { scope: it.scope, productId: it.productId, items: [] }; grouped.set(key, g); }
    g.items.push({ status: it.status, exceptionFlag: it.exceptionFlag });
  }
  const nameOf = new Map<number, string>();
  if (grouped.size) {
    const products = await prisma.product.findMany({ where: { id: { in: [...new Set([...grouped.values()].map((g) => g.productId))] } }, select: { id: true, name: true } });
    for (const p of products) nameOf.set(p.id, p.name);
  }
  let list: RequestPoolRow[] = [...grouped.values()].map((g) => {
    const outstanding = g.items.filter((it) => it.status !== "WEBSITE").length;
    return { scope: g.scope, productId: g.productId, productName: nameOf.get(g.productId) ?? "—", stages: stageTally(g.items), total: g.items.length, outstanding };
  });
  if (opts.onlyUnfulfilled) list = list.filter((r) => r.outstanding > 0);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    list = list.filter((r) => r.productName.toLowerCase().includes(q));
  }
  return list.sort((a, b) => b.total - a.total || a.productName.localeCompare(b.productName));
}

/** Lightweight (id + deliveredAt) for all in-scope requests — feeds the SLA
 *  risk/delayed summary so it stays whole-scope while the table is paginated. */
export function listRequestSlaInputs(opts: { scopes: string[] }) {
  return prisma.request.findMany({
    where: { archivedAt: null, scope: { in: opts.scopes } },
    select: { id: true, deliveredAt: true },
  });
}

export function getRequest(id: number) {
  return prisma.request.findFirst({
    where: { id, archivedAt: null },
    include: {
      customer: { select: { id: true, name: true } },
      lines: { include: { product: { select: { id: true, name: true, uid: true } } } },
      photos: true,
    },
  });
}

/** The items spawned by a request, with product + current status. */
export function getRequestItems(requestId: number) {
  return prisma.item.findMany({
    where: { requestId },
    orderBy: { id: "asc" },
    include: { product: { select: { id: true, name: true, type: true, defaultSupplier: { select: { slaClass: true } } } } },
  });
}

export function listCustomerOptions(scopes: string[]) {
  return prisma.customer.findMany({
    where: { archivedAt: null, active: true, scope: { in: scopes } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, scope: true },
  });
}

export async function listScopedProducts(scopes: string[]) {
  const rows = await prisma.product.findMany({
    where: { archivedAt: null, active: true, scope: { in: scopes } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true, scope: true, type: true, sellingPrice: true, purchasePrice: true },
  });
  return rows;
}

/** Name/scope/type of the given products — feeds requestLineProductError. */
export function getLineProductRefs(ids: number[]) {
  if (!ids.length) return Promise.resolve([]);
  return prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, scope: true, type: true },
  });
}
