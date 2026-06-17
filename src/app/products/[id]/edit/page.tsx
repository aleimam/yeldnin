import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { productScopes, primaryProductModule } from "@/lib/products/products-logic";
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
  const [t, suppliers] = await Promise.all([getT(), listSuppliersForPicker()]);

  return (
    <AppShell access={access} moduleKey={primaryProductModule(access)} pageTitle={`${t("products.edit")} · ${product.name}`} backHref={`/products/${id}`}>
      <ProductForm
        mode="edit"
        allowedScopes={manageable}
        suppliers={suppliers.map((s) => ({ id: s.id, label: supplierLabel(s) }))}
        initial={{
          id: product.id,
          name: product.name,
          sku: product.sku ?? "",
          scope: product.scope,
          type: product.type,
          defaultSupplierId: product.defaultSupplierId ? String(product.defaultSupplierId) : "",
          weightG: product.weightG != null ? String(product.weightG) : "",
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
