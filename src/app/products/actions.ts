"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/access";
import {
  productScopes,
  validateProduct,
  canSeePurchasePrice,
  type Scope,
  type ProductType,
} from "@/lib/products/products-logic";
import { createProduct, updateProduct, archiveProduct, getProduct } from "@/lib/products/products-service";
import { writeAudit } from "@/lib/audit";

export interface ProductPayload {
  name: string;
  sku?: string;
  scope: string;
  type: string;
  originRegion?: string | null;
  defaultSupplierId?: number | null;
  weightG?: number | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  size?: string;
  grade?: string;
  url?: string;
  notes?: string;
  isMaleSupport: boolean;
  photoIds?: string[];
}
export type ProductResult = { ok: true; id: number } | { ok: false; error: string };

export async function createProductAction(p: ProductPayload): Promise<ProductResult> {
  const access = await requireUser();
  const errs = validateProduct(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  if (!productScopes(access, "OPERATE").includes(p.scope as Scope)) {
    return { ok: false, error: "You can't add products in that scope." };
  }
  // Purchase price is Purchasing/Logistics-only — ignore any value a Sales/XOONX
  // creator's client might send (defense-in-depth behind the hidden field).
  const purchasePrice = canSeePurchasePrice(access) ? p.purchasePrice ?? null : null;
  const prod = await createProduct(
    { ...p, purchasePrice, scope: p.scope as Scope, type: p.type as ProductType },
    p.photoIds ?? [],
    access.user.id,
  );
  await writeAudit(access.user.id, "purchasing", "product.create", "product", prod.id, { name: p.name, scope: p.scope });
  revalidatePath("/products");
  return { ok: true, id: prod.id };
}

export async function saveProductAction(p: ProductPayload & { id: number; active: boolean }): Promise<ProductResult> {
  const access = await requireUser();
  const errs = validateProduct(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  if (!productScopes(access, "OPERATE").includes(p.scope as Scope)) {
    return { ok: false, error: "You can't manage products in that scope." };
  }
  // Purchase price is Purchasing/Logistics-only: a user who can't see it can't
  // change it — preserve the stored value rather than the (absent) client one.
  let purchasePrice = p.purchasePrice ?? null;
  if (!canSeePurchasePrice(access)) {
    const existing = await getProduct(p.id);
    purchasePrice = existing?.purchasePrice ?? null;
  }
  await updateProduct(
    p.id,
    { ...p, purchasePrice, scope: p.scope as Scope, type: p.type as ProductType, active: p.active },
    p.photoIds ?? [],
    access.user.id,
  );
  await writeAudit(access.user.id, "purchasing", "product.update", "product", p.id);
  revalidatePath("/products");
  revalidatePath(`/products/${p.id}`);
  return { ok: true, id: p.id };
}

export async function archiveProductAction(id: number): Promise<void> {
  const access = await requireUser();
  const product = await getProduct(id);
  if (!product || !productScopes(access, "OPERATE").includes(product.scope as Scope)) return;
  await archiveProduct(id);
  await writeAudit(access.user.id, "purchasing", "product.archive", "product", id);
  revalidatePath("/products");
}
