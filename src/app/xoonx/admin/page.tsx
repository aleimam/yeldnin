import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listExpenseCategories, getFxRates, getStaffShares } from "@/lib/xoonx/xoonx-finance-service";
import { monthKey, FX_CURRENCIES } from "@/lib/xoonx/xoonx-finance-logic";
import { AdminPanel } from "./AdminPanel";

export default async function XoonxAdminPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const access = await requireModule("xoonx", "MANAGE");
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : monthKey(new Date());

  const [t, categories, fx, staff] = await Promise.all([
    getT(),
    listExpenseCategories(true),
    getFxRates(month),
    getStaffShares(),
  ]);

  return (
    <AppShell access={access} moduleKey="xoonx" pageTitle={t("xoonx.admin")}>
      <AdminPanel
        month={month}
        currencies={[...FX_CURRENCIES]}
        fx={Object.fromEntries(fx)}
        categories={categories.map((c) => ({ id: c.id, name: c.name, enabled: c.enabled }))}
        staff={staff}
      />
    </AppShell>
  );
}
