import { requireAdmin } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listExpenseCategories, getFxRates, getStaffShares, listXoonxPartnerCandidates } from "@/lib/xoonx/xoonx-finance-service";
import { monthKey, FX_CURRENCIES } from "@/lib/xoonx/xoonx-finance-logic";
import { AdminPanel } from "./AdminPanel";

export default async function XoonxSettingsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const access = await requireAdmin();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : monthKey(new Date());

  const [t, categories, fx, staff, candidates] = await Promise.all([
    getT(),
    listExpenseCategories(true),
    getFxRates(month),
    getStaffShares(),
    listXoonxPartnerCandidates(),
  ]);

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("settings.xoonx")} backHref="/settings">
      <AdminPanel
        month={month}
        currencies={[...FX_CURRENCIES]}
        fx={Object.fromEntries(fx)}
        categories={categories.map((c) => ({ id: c.id, name: c.name, enabled: c.enabled }))}
        staff={staff}
        candidates={candidates}
      />
    </AppShell>
  );
}
