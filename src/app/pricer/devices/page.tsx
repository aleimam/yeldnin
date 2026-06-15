import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { listSuppliers } from "@/lib/suppliers/suppliers-service";
import { DeviceCalculator } from "../DeviceCalculator";

export default async function DevicesPage() {
  const access = await requireModule("egv_pricer", "VIEW");
  const suppliers = await listSuppliers();
  return (
    <AppShell access={access} moduleKey="egv_pricer">
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
