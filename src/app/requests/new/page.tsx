import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { requestScopes, primaryRequestModule } from "@/lib/requests/request-logic";
import { canSeePurchasePrice } from "@/lib/products/products-logic";
import { listScopedProducts, listCustomerOptions } from "@/lib/requests/request-service";
import { getSla } from "@/lib/sla/sla-config-service";
import { RequestForm } from "../RequestForm";

export default async function NewRequestPage() {
  const access = await requireUser();
  const allowed = requestScopes(access, "OPERATE");
  if (!allowed.length) redirect("/");
  const [t, rawProducts, customers, sla] = await Promise.all([getT(), listScopedProducts(allowed), listCustomerOptions(allowed), getSla()]);
  const canSeePurchase = canSeePurchasePrice(access);
  // Don't ship buy prices into a Sales user's page props.
  const products = canSeePurchase ? rawProducts : rawProducts.map((p) => ({ ...p, purchasePrice: null }));

  return (
    <AppShell access={access} moduleKey={primaryRequestModule(access)} pageTitle={t("requests.new")} backHref="/requests">
      <RequestForm allowedScopes={allowed} products={products} customers={customers} depositPct={sla.depositPct} canSeePurchase={canSeePurchase} />
    </AppShell>
  );
}
