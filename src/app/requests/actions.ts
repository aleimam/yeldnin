"use server";
import { revalidatePath } from "next/cache";
import { requireUser, requireCapability } from "@/lib/auth/access";
import { requestScopes, validateRequest, requestLineProductError, type RequestType } from "@/lib/requests/request-logic";
import { type Scope, canSeePurchasePrice } from "@/lib/products/products-logic";
import { createRequest, updateRequest, approveRequest, rejectRequest, getRequest, getLineProductRefs } from "@/lib/requests/request-service";
import { markRequestDelivered, unmarkRequestDelivered } from "@/lib/xoonx/xoonx-finance-service";
import { getCustomer } from "@/lib/customers/customers-service";
import { writeAudit } from "@/lib/audit";

export interface RequestPayload {
  type: string;
  scope: string;
  customerId?: number | null;
  newCustomer?: { name: string; contactNumber?: string } | null;
  notes?: string;
  deposit?: number | null;
  lines: { productId: number; count: number; sellingPrice?: number | null; purchasePrice?: number | null; purchaseCurrency?: string | null; notes?: string }[];
  photoIds?: string[];
}
export type RequestResult = { ok: true; id: number } | { ok: false; error: string };

/** Lines must reference existing products in the request's scope; XOONX
 *  requests may only contain XOONX-type products. Null when valid. */
async function checkLineProducts(scope: string, lines: { productId: number }[]): Promise<string | null> {
  const ids = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
  const refs = await getLineProductRefs(ids);
  if (refs.length !== ids.length) return "One of the products no longer exists.";
  return requestLineProductError(scope, refs);
}

/** GOLDEN RULE: a request may only reference a customer on its OWN business
 *  line. The foreign key proves the id exists but says nothing about scope, so
 *  an off-scope customer id was being persisted and then rendered on the request
 *  page — disclosing the other line's customer identity.
 *
 *  Missing and off-scope deliberately return the SAME message; distinguishing
 *  them would turn this into an existence oracle for the other line. */
async function checkCustomerScope(scope: string, customerId?: number | null): Promise<string | null> {
  if (!customerId) return null;
  const c = await getCustomer(customerId);
  return c && c.scope === scope ? null : "That customer isn't available.";
}

/** Buy price is hidden from VEEEY Sales (golden rule). Drop any line purchase
 *  price a user who can't see it might have sent — defense-in-depth behind the
 *  hidden field, so it can't be set or wiped from a crafted request. */
function stripHiddenPurchase<T extends { purchasePrice?: number | null }>(lines: T[], canSeePurchase: boolean): T[] {
  return canSeePurchase ? lines : lines.map((l) => ({ ...l, purchasePrice: null }));
}

export async function createRequestAction(p: RequestPayload): Promise<RequestResult> {
  const access = await requireUser();
  const errs = validateRequest({
    type: p.type,
    scope: p.scope,
    customerId: p.customerId,
    newCustomerName: p.newCustomer?.name,
    lines: p.lines,
  });
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  if (!requestScopes(access, "OPERATE").includes(p.scope as Scope)) {
    return { ok: false, error: "You can't place requests in that scope." };
  }
  const prodErr = await checkLineProducts(p.scope, p.lines);
  if (prodErr) return { ok: false, error: prodErr };
  const custErr = await checkCustomerScope(p.scope, p.customerId);
  if (custErr) return { ok: false, error: custErr };
  const req = await createRequest(
    {
      type: p.type as RequestType,
      scope: p.scope,
      customerId: p.customerId ?? null,
      newCustomer: p.newCustomer ?? null,
      notes: p.notes ?? null,
      deposit: p.deposit ?? null,
      lines: stripHiddenPurchase(p.lines, canSeePurchasePrice(access)),
    },
    p.photoIds ?? [],
    access.user.id,
  );
  await writeAudit(access.user.id, "order_requests", "request.create", "request", req.id, { type: p.type, scope: p.scope });
  revalidatePath("/requests");
  return { ok: true, id: req.id };
}

/** Edit a request (any in-scope OPERATE user). VEEEY edits return it to PENDING. */
export async function updateRequestAction(id: number, p: RequestPayload): Promise<RequestResult> {
  const access = await requireUser();
  const existing = await getRequest(id);
  if (!existing) return { ok: false, error: "Request not found." };
  if (!requestScopes(access, "OPERATE").includes(existing.scope as Scope)) {
    return { ok: false, error: "You can't edit requests in that scope." };
  }
  // XOONX requests are born approved, so any edit changes an approved order's
  // prices/deposit — gated by xoonx.editRequest (default MANAGE).
  if (existing.scope === "XOONX" && !access.can("xoonx", "editRequest")) {
    return { ok: false, error: "Only a XOONX manager can edit an approved XOONX request." };
  }
  const errs = validateRequest({ type: p.type, scope: existing.scope, customerId: p.customerId, newCustomerName: p.newCustomer?.name, lines: p.lines });
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  const prodErr = await checkLineProducts(existing.scope, p.lines);
  if (prodErr) return { ok: false, error: prodErr };
  const custErr = await checkCustomerScope(existing.scope, p.customerId);
  if (custErr) return { ok: false, error: custErr };
  try {
    await updateRequest(
      id,
      {
        type: p.type as RequestType,
        scope: existing.scope,
        customerId: p.customerId ?? null,
        newCustomer: p.newCustomer ?? null,
        notes: p.notes ?? null,
        deposit: p.deposit ?? null,
        lines: stripHiddenPurchase(p.lines, canSeePurchasePrice(access)),
      },
      p.photoIds ?? [],
      access.user.id,
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save the request." };
  }
  await writeAudit(access.user.id, "order_requests", "request.update", "request", id, {});
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  return { ok: true, id };
}

/** GOLDEN RULE: the approve capability says the caller may approve — not that
 *  they may approve THIS record. Without loading the request, an approver could
 *  confirm any id's existence (success vs "not found") and mutate an off-scope
 *  PENDING row into spawned items. Missing and off-scope answer identically. */
async function assertRequestInScope(access: Awaited<ReturnType<typeof requireUser>>, id: number): Promise<string | null> {
  const existing = await getRequest(id);
  if (!existing || !requestScopes(access, "OPERATE").includes(existing.scope as Scope)) return "Request not found.";
  return null;
}

/** Approve a pending VEEEY request → spawns its items into the purchasing pool. */
export async function approveRequestAction(id: number): Promise<{ ok: boolean; error?: string }> {
  const access = await requireCapability("order_requests", "approve");
  const scopeErr = await assertRequestInScope(access, id);
  if (scopeErr) return { ok: false, error: scopeErr };
  try {
    await approveRequest(id, access.user.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
  await writeAudit(access.user.id, "order_requests", "request.approve", "request", id, {});
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  return { ok: true };
}

/** Reject a pending VEEEY request (no items spawned). */
export async function rejectRequestAction(id: number, note: string | null): Promise<{ ok: boolean; error?: string }> {
  const access = await requireCapability("order_requests", "approve");
  const scopeErr = await assertRequestInScope(access, id);
  if (scopeErr) return { ok: false, error: scopeErr };
  try {
    await rejectRequest(id, note, access.user.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
  await writeAudit(access.user.id, "order_requests", "request.reject", "request", id, {});
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  return { ok: true };
}

/** Mark (or un-mark) a XOONX order delivered — books its revenue into that month. */
export async function markDeliveredAction(id: number, delivered: boolean): Promise<{ ok: boolean; error?: string }> {
  const access = await requireCapability("xoonx", "deliver");
  try {
    if (delivered) await markRequestDelivered(id, access.user.id);
    else await unmarkRequestDelivered(id, access.user.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  revalidatePath("/xoonx/reports");
  return { ok: true };
}
