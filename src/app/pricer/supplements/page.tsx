import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { listSuppliers } from "@/lib/suppliers/suppliers-service";
import { SupplementCalculator } from "../SupplementCalculator";

export default async function SupplementsPage() {
  const access = await requireModule("egv_pricer", "VIEW");
  const suppliers = await listSuppliers();
  return (
    <AppShell access={access} moduleKey="egv_pricer">
      <SupplementCalculator
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
