import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes } from "@/lib/products/products-logic";
import { listSuppliersForPicker } from "@/lib/products/products-service";
import { pendingPool, listHubsForPicker } from "@/lib/purchasing/purchasing-service";
import { eligibleTripsForPurchase } from "@/lib/trips/trip-service";
import { supplierLabel } from "@/app/products/supplier-label";
import { PurchaseForm } from "../../PurchaseForm";

export default async function NewPurchasePage() {
  const access = await requireModule("purchasing", "OPERATE");
  const scopes = productScopes(access, "VIEW");
  const [t, pool, suppliers, hubs, trips] = await Promise.all([
    getT(),
    pendingPool(scopes),
    listSuppliersForPicker(),
    listHubsForPicker(),
    eligibleTripsForPurchase(),
  ]);

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("purchasing.new")} backHref="/purchasing/pool">
      <PurchaseForm
        allowedScopes={scopes}
        pool={pool}
        suppliers={suppliers.map((s) => ({ id: s.id, label: supplierLabel(s) }))}
        hubs={hubs}
        trips={trips}
      />
    </AppShell>
  );
}
