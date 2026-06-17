import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes } from "@/lib/products/products-logic";
import { getPurchase, purchaseOnWebsite } from "@/lib/purchasing/purchasing-service";
import { listSuppliersForPicker } from "@/lib/products/products-service";
import { listCountryOptions } from "@/lib/countries/countries-service";
import { supplierLabel } from "@/app/products/supplier-label";
import { PurchaseEditForm } from "../../../PurchaseEditForm";

export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  if (!access.canModule("purchasing", "OPERATE") && !access.canModule("logistics", "OPERATE")) notFound();
  const scopes = productScopes(access, "VIEW");
  const { id } = await params;
  const purchase = await getPurchase(Number(id));
  if (!purchase || !scopes.includes(purchase.scope as never)) notFound();
  if (await purchaseOnWebsite(purchase.id)) redirect(`/purchasing/purchases/${purchase.id}`);
  const [t, suppliers, countries] = await Promise.all([getT(), listSuppliersForPicker(), listCountryOptions()]);

  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={`${t("common.edit")} · ${purchase.uid ?? `#${purchase.id}`}`}
      backHref={`/purchasing/purchases/${purchase.id}`}
    >
      <PurchaseEditForm
        id={purchase.id}
        initial={{
          country: purchase.country,
          supplierId: purchase.supplierId,
          purchasePrice: purchase.purchasePrice,
          notes: purchase.notes ?? "",
          handlingFee: purchase.handlingFee,
          handlingFeeCurrency: purchase.handlingFeeCurrency,
        }}
        suppliers={suppliers.map((s) => ({ id: s.id, label: supplierLabel(s) }))}
        countries={countries}
      />
    </AppShell>
  );
}
