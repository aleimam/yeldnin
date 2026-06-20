import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { payrollMonth } from "@/lib/hr/hr-analytics-service";
import { PayrollDashboard } from "../PayrollDashboard";

export default async function PayrollDashboardPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const access = await requireUser();
  if (!access.isAdmin && !access.can("human_resources", "manage")) redirect("/hr");
  const t = await getT();
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.y) || now.getUTCFullYear();
  const month = Number(sp.m) || now.getUTCMonth() + 1;
  const { rows, totals } = await payrollMonth(year, month);

  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("pay.title")} backHref="/hr">
      <PayrollDashboard year={year} month={month} rows={rows} totals={totals} />
    </AppShell>
  );
}
