import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes } from "@/lib/products/products-logic";
import { listSuppliersForPicker } from "@/lib/products/products-service";
import { pendingPool, listHubsForPicker } from "@/lib/purchasing/purchasing-service";
import { eligibleTripsForPurchase } from "@/lib/trips/trip-service";
import { listCountryOptions } from "@/lib/countries/countries-service";
import { supplierLabel } from "@/app/products/supplier-label";
import { PurchaseForm } from "../../PurchaseForm";

export default async function NewPurchasePage() {
  const access = await requireCapability("purchasing", "operate");
  const scopes = productScopes(access, "VIEW");
  const [t, pool, suppliers, hubs, trips, countries] = await Promise.all([
    getT(),
    pendingPool(scopes),
    listSuppliersForPicker(),
    listHubsForPicker(),
    eligibleTripsForPurchase(),
    listCountryOptions(),
  ]);

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("purchasing.new")} backHref="/purchasing/pool">
      <PurchaseForm
        allowedScopes={scopes}
        pool={pool}
        suppliers={suppliers.map((s) => ({ id: s.id, label: supplierLabel(s), availableUSA: s.availableUSA, availableUK: s.availableUK, availableEU: s.availableEU }))}
        hubs={hubs}
        trips={trips}
        countries={countries}
      />
    </AppShell>
  );
}
