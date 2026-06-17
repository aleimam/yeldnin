import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes, primaryProductModule } from "@/lib/products/products-logic";
import { listSuppliersForPicker } from "@/lib/products/products-service";
import { ProductForm } from "../ProductForm";
import { supplierLabel } from "../supplier-label";

export default async function NewProductPage() {
  const access = await requireUser();
  const manageable = productScopes(access, "OPERATE");
  if (!manageable.length) redirect("/");
  const [t, suppliers] = await Promise.all([getT(), listSuppliersForPicker()]);

  return (
    <AppShell access={access} moduleKey={primaryProductModule(access)} pageTitle={t("products.new")} backHref="/products">
      <ProductForm
        mode="create"
        allowedScopes={manageable}
        suppliers={suppliers.map((s) => ({ id: s.id, label: supplierLabel(s) }))}
        initial={{
          name: "", sku: "", scope: "", type: "SUPPLEMENT", defaultSupplierId: "",
          weightG: "", purchasePrice: "", sellingPrice: "", size: "", grade: "", url: "", notes: "", isMaleSupport: false, active: true, photos: [],
        }}
      />
    </AppShell>
  );
}
