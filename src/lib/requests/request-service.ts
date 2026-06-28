import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";
import { createItems } from "@/lib/items/items-service";
import { createCustomer } from "@/lib/customers/customers-service";
import { getSla } from "@/lib/sla/sla-config-service";
import { graceDays, sourceClass, promisedDate } from "@/lib/sla/sla-logic";
import { usesApprovalGate, requestLinesEditable } from "./request-logic";
import { sendCustomNotification } from "@/lib/notify/notify-message-service";
import { moduleOperatorIds } from "@/lib/notify/notify-service";
import { makeT, isLocale, DEFAULT_LOCALE } from "@/i18n";
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
  if (!gated) await spawnRequestItems(request.id, userId);
  else await notifyRequestPending(request, userId);
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

/** Send one localized in-app/push notification per recipient (skips the actor).
 *  Best-effort: never throws. */
async function notifyLocalized(
  userIds: number[],
  titleKey: string,
  bodyKey: string,
  vars: Record<string, string | number>,
  link: string,
  type: string,
  actorId: number,
) {
  const recipients = [...new Set(userIds)].filter((u) => u !== actorId);
  if (!recipients.length) return;
  const users = await prisma.user.findMany({ where: { id: { in: recipients } }, select: { id: true, locale: true } });
  await Promise.allSettled(
    users.map((u) => {
      const tt = makeT(isLocale(u.locale) ? u.locale : DEFAULT_LOCALE);
      return sendCustomNotification(
        { title: tt(titleKey), body: tt(bodyKey, vars), link, type, target: { userIds: [u.id] } },
        actorId,
      );
    }),
  );
}

/** Tell the EGV approvers (order_requests MANAGE + admins) a request awaits review. */
async function notifyRequestPending(req: RequestActorRef, actorId: number) {
  if (req.scope !== "EGV") return;
  const approvers = await moduleOperatorIds(["order_requests"], "MANAGE");
  await notifyLocalized(approvers, "req.notif.pendingTitle", "req.notif.pendingBody", { ref: req.uid ?? `#${req.id}` }, `/requests/${req.id}`, "info", actorId).catch(() => {});
}

/** Tell the request's creator that it was approved / rejected. */
async function notifyRequestDecision(req: RequestActorRef, approved: boolean, actorId: number) {
  if (!req.createdById) return;
  await notifyLocalized(
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
  const req = await prisma.request.findFirst({ where: { id, archivedAt: null }, select: { id: true, uid: true, scope: true, createdById: true } });
  if (!req) throw new Error("Request not found.");
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
  if (!gated) await spawnRequestItems(id, userId);
  else await notifyRequestPending({ id: req.id, uid: req.uid, scope: req.scope, status: "PENDING", createdById: req.createdById }, userId);
  return { id, needsApproval: gated };
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
export async function listRequestsPaged(opts: {
  scopes: string[];
  search?: string;
  type?: string;
  status?: string;
  sort?: RequestSortKey;
  dir?: "asc" | "desc";
  skip?: number;
  take?: number;
}) {
  const where = {
    archivedAt: null,
    scope: { in: opts.scopes },
    ...(opts.type ? { type: opts.type } : {}),
    ...(opts.status ? { status: opts.status } : {}),
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
  requested: number; // all items ever requested for this product (in scope)
  ongoing: number; // still in motion = requested − delivered − errant
  delivered: number; // reached the final WEBSITE state
  errant: number; // flagged ERRANT
}
/**
 * Per-product request pool: for every product that's been requested in scope,
 * how many requested units are ongoing / delivered (reached WEBSITE) / errant.
 * Mirrors the logistics purchasing pool, for the Sales view.
 */
export async function requestPool(scopes: string[], search?: string): Promise<RequestPoolRow[]> {
  if (!scopes.length) return [];
  const items = await prisma.item.findMany({
    where: { requestId: { not: null }, scope: { in: scopes } },
    select: { productId: true, scope: true, status: true, exceptionFlag: true },
  });
  const rows = new Map<string, RequestPoolRow>();
  for (const it of items) {
    const key = `${it.scope}:${it.productId}`;
    let r = rows.get(key);
    if (!r) {
      r = { scope: it.scope, productId: it.productId, productName: "—", requested: 0, ongoing: 0, delivered: 0, errant: 0 };
      rows.set(key, r);
    }
    r.requested++;
    if (it.exceptionFlag === "ERRANT") r.errant++;
    else if (it.status === "WEBSITE") r.delivered++;
    else r.ongoing++;
  }
  if (rows.size) {
    const products = await prisma.product.findMany({ where: { id: { in: [...new Set([...rows.values()].map((r) => r.productId))] } }, select: { id: true, name: true } });
    const nameOf = new Map(products.map((p) => [p.id, p.name]));
    for (const r of rows.values()) r.productName = nameOf.get(r.productId) ?? "—";
  }
  let list = [...rows.values()];
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((r) => r.productName.toLowerCase().includes(q));
  }
  return list;
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
    select: { id: true, name: true, sku: true, scope: true, sellingPrice: true, purchasePrice: true },
  });
  return rows;
}
