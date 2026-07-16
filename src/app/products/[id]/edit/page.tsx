import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { productScopes, primaryProductModule, canSeePurchasePrice } from "@/lib/products/products-logic";
import { getProduct, listSuppliersForPicker } from "@/lib/products/products-service";
import { ProductForm } from "../../ProductForm";
import { supplierLabel } from "../../supplier-label";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const { id } = await params;
  const product = await getProduct(Number(id));
  if (!product) notFound();
  // Must be able to manage this product's scope to edit it.
  if (!productScopes(access, "OPERATE").includes(product.scope as never)) redirect(`/products/${id}`);
  const manageable = productScopes(access, "OPERATE");
  const canSeePurchase = canSeePurchasePrice(access);
  const [t, suppliers] = await Promise.all([getT(), listSuppliersForPicker()]);

  return (
    <AppShell access={access} moduleKey={primaryProductModule(access)} pageTitle={`${t("products.edit")} · ${product.name}`} backHref={`/products/${id}`}>
      <ProductForm
        mode="edit"
        allowedScopes={manageable}
        canSeePurchase={canSeePurchase}
        suppliers={suppliers.map((s) => ({ id: s.id, label: supplierLabel(s), regions: [s.availableUSA && "USA", s.availableUK && "UK", s.availableEU && "EU"].filter(Boolean) as string[] }))}
        initial={{
          id: product.id,
          name: product.name,
          sku: product.sku ?? "",
          scope: product.scope,
          type: product.type,
          originRegion: product.originRegion ?? "",
          defaultSupplierId: product.defaultSupplierId ? String(product.defaultSupplierId) : "",
          weightG: product.weightG != null ? String(product.weightG) : "",
          // Don't ship the buy price into a non-purchasing user's page props.
          purchasePrice: canSeePurchase && product.purchasePrice != null ? String(product.purchasePrice) : "",
          sellingPrice: product.sellingPrice != null ? String(product.sellingPrice) : "",
          size: product.size ?? "",
          grade: product.grade ?? "",
          url: product.url ?? "",
          notes: product.notes ?? "",
          isMaleSupport: product.isMaleSupport,
          active: product.active,
          photos: product.photos.map((ph) => ({ id: ph.assetId, url: assetUrl(ph.assetId)! })),
        }}
      />
    </AppShell>
  );
}
