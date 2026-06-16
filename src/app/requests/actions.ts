"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/access";
import { requestScopes, validateRequest, type RequestType } from "@/lib/requests/request-logic";
import { type Scope } from "@/lib/products/products-logic";
import { createRequest } from "@/lib/requests/request-service";
import { writeAudit } from "@/lib/audit";

export interface RequestPayload {
  type: string;
  scope: string;
  customerId?: number | null;
  newCustomer?: { name: string; contactNumber?: string } | null;
  notes?: string;
  lines: { productId: number; count: number; sellingPrice?: number | null; purchasePrice?: number | null; notes?: string }[];
  photoIds?: string[];
}
export type RequestResult = { ok: true; id: number } | { ok: false; error: string };

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
  const req = await createRequest(
    {
      type: p.type as RequestType,
      scope: p.scope,
      customerId: p.customerId ?? null,
      newCustomer: p.newCustomer ?? null,
      notes: p.notes ?? null,
      lines: p.lines,
    },
    p.photoIds ?? [],
    access.user.id,
  );
  await writeAudit(access.user.id, "order_requests", "request.create", "request", req.id, { type: p.type, scope: p.scope });
  revalidatePath("/requests");
  return { ok: true, id: req.id };
}
