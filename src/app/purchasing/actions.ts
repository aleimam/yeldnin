"use server";
import { revalidatePath } from "next/cache";
import { requireModule, requireUser } from "@/lib/auth/access";
import { productScopes, type Scope } from "@/lib/products/products-logic";
import { validatePurchase } from "@/lib/purchasing/purchasing-logic";
import { createPurchase, advancePurchaseStatus, receivePurchaseAtOffice, addGiftItems, updatePurchase } from "@/lib/purchasing/purchasing-service";
import { writeAudit } from "@/lib/audit";

export interface PurchasePayload {
  scope: string;
  country: string;
  supplierId?: number | null;
  purchasePrice?: number | null;
  destinationType: string;
  destinationId?: number | null;
  notes?: string;
  lines: { productId: number; count: number }[];
}
export type PurchaseResult = { ok: true; id: number } | { ok: false; error: string };

export async function createPurchaseAction(p: PurchasePayload): Promise<PurchaseResult> {
  const access = await requireModule("purchasing", "OPERATE");
  const errs = validatePurchase(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  if (!productScopes(access, "VIEW").includes(p.scope as Scope)) {
    return { ok: false, error: "You can't purchase in that scope." };
  }
  try {
    const purchase = await createPurchase(
      {
        scope: p.scope,
        country: p.country,
        supplierId: p.supplierId ?? null,
        purchasePrice: p.purchasePrice ?? null,
        destinationType: p.destinationType,
        destinationId: p.destinationId ?? null,
        notes: p.notes ?? null,
        lines: p.lines,
      },
      access.user.id,
    );
    await writeAudit(access.user.id, "purchasing", "purchase.create", "purchase", purchase.id, { scope: p.scope });
    revalidatePath("/purchasing/pool");
    revalidatePath("/purchasing/purchases");
    return { ok: true, id: purchase.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create the purchase." };
  }
}

async function requirePurchaseManage() {
  const access = await requireUser();
  if (!access.canModule("purchasing", "OPERATE") && !access.canModule("logistics", "OPERATE")) {
    throw new Error("Not allowed.");
  }
  return access;
}

/** Purchasing/logistics advance a purchase's status forward (until on website). */
export async function advancePurchaseStatusAction(id: number): Promise<void> {
  const access = await requirePurchaseManage();
  await advancePurchaseStatus(id, access.user.id);
  await writeAudit(access.user.id, "purchasing", "purchase.advance", "purchase", id);
  revalidatePath(`/purchasing/purchases/${id}`);
  revalidatePath("/purchasing/purchases");
}

/** Bypass patches: receive the purchase straight to its destination. */
export async function receivePurchaseAtOfficeAction(id: number): Promise<void> {
  const access = await requirePurchaseManage();
  await receivePurchaseAtOffice(id, access.user.id);
  await writeAudit(access.user.id, "purchasing", "purchase.receiveNoPatch", "purchase", id);
  revalidatePath(`/purchasing/purchases/${id}`);
  revalidatePath("/purchasing/purchases");
}

/** Edit a purchase's metadata (until it's on the website). */
export async function updatePurchaseAction(
  id: number,
  p: { country: string; supplierId?: number | null; purchasePrice?: number | null; notes?: string },
): Promise<PurchaseResult> {
  const access = await requirePurchaseManage();
  if (!p.country?.trim()) return { ok: false, error: "Country is required." };
  await updatePurchase(
    id,
    {
      country: p.country.trim(),
      supplierId: p.supplierId ?? null,
      purchasePrice: p.purchasePrice ?? null,
      notes: p.notes ?? null,
    },
    access.user.id,
  );
  await writeAudit(access.user.id, "purchasing", "purchase.update", "purchase", id);
  revalidatePath(`/purchasing/purchases/${id}`);
  revalidatePath("/purchasing/purchases");
  return { ok: true, id };
}

/** Add free gift items to a purchase. */
export async function addGiftItemsAction(p: { purchaseId: number; productId: number; count: number }): Promise<void> {
  const access = await requirePurchaseManage();
  await addGiftItems(p.purchaseId, p.productId, p.count, access.user.id);
  await writeAudit(access.user.id, "purchasing", "purchase.addGift", "purchase", p.purchaseId, { productId: p.productId, count: p.count });
  revalidatePath(`/purchasing/purchases/${p.purchaseId}`);
}
