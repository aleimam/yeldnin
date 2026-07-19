import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes, primaryProductModule, canSeePurchasePrice } from "@/lib/products/products-logic";
import { listSuppliersForPicker } from "@/lib/products/products-service";
import { ProductForm } from "../ProductForm";
import { supplierLabel } from "../supplier-label";

export default async function NewProductPage() {
  const access = await requireUser();
  // VEEEY products are born in the Veeey storefront and synced in — you can't
  // hand-create them here, so exclude VEEEY from the create scopes.
  const manageable = productScopes(access, "OPERATE").filter((s) => s !== "VEEEY");
  if (!manageable.length) redirect("/");
  const [t, suppliers] = await Promise.all([getT(), listSuppliersForPicker()]);

  return (
    <AppShell access={access} moduleKey={primaryProductModule(access)} pageTitle={t("products.new")} backHref="/products">
      <ProductForm
        mode="create"
        allowedScopes={manageable}
        canSeePurchase={canSeePurchasePrice(access)}
        suppliers={suppliers.map((s) => ({ id: s.id, label: supplierLabel(s), regions: [s.availableUSA && "USA", s.availableUK && "UK", s.availableEU && "EU"].filter(Boolean) as string[] }))}
        initial={{
          name: "", sku: "", scope: "", type: "SUPPLEMENT", originRegion: "", defaultSupplierId: "",
          weightG: "", purchasePrice: "", sellingPrice: "", size: "", grade: "", url: "", notes: "", isMaleSupport: false, active: true, photos: [],
        }}
      />
    </AppShell>
  );
}
