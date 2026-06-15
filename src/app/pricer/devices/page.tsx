import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listSuppliers } from "@/lib/suppliers/suppliers-service";
import { PricerNav } from "../PricerNav";
import { DeviceCalculator } from "../DeviceCalculator";

export default async function DevicesPage() {
  const access = await requireModule("egv_pricer", "VIEW");
  const [t, suppliers] = await Promise.all([getT(), listSuppliers()]);
  return (
    <AppShell user={access.user} title={t("module.egv_pricer.name")} backHref="/">
      <PricerNav canManage={access.canModule("egv_pricer", "MANAGE")} />
      <DeviceCalculator
        suppliers={suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          availableUSA: s.availableUSA,
          availableUK: s.availableUK,
          availableEU: s.availableEU,
        }))}
      />
    </AppShell>
  );
}
