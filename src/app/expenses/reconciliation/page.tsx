import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { calculateMonthlyReconciliation } from "@/lib/expenses/expenses-service";

const RECON_COLOR: Record<string, string> = {
  GREEN: "bg-green-100 text-green-700",
  YELLOW: "bg-amber-100 text-amber-700",
  RED: "bg-red-100 text-red-700",
};

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const access = await requireModule("expenses", "VIEW");
  const t = await getT();
  const now = new Date();
  const sp = await searchParams;
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const result = await calculateMonthlyReconciliation(year, month);
  const egp = (n: number) => `${Math.round(n).toLocaleString()} EGP`;

  return (
    <AppShell access={access} moduleKey="expenses" pageTitle={t("exp.reconciliation")}>

      <form className="mb-6 flex items-end gap-3">
        <div>
          <label className="label">{t("exp.year")}</label>
          <input name="year" type="number" defaultValue={year} className="input w-28" />
        </div>
        <div>
          <label className="label">{t("exp.month")}</label>
          <input name="month" type="number" min="1" max="12" defaultValue={month} className="input w-24" />
        </div>
        <button className="btn-secondary">{t("exp.reconciliation")}</button>
      </form>

      <div className="card max-w-md space-y-3 p-6">
        <div className="flex justify-between"><span className="text-muted">{t("exp.expected")}</span><span className="font-medium">{egp(result.expected)}</span></div>
        <div className="flex justify-between"><span className="text-muted">{t("exp.actual")}</span><span className="font-medium">{egp(result.actual)}</span></div>
        <div className="flex justify-between border-t border-line pt-3"><span className="text-muted">{t("exp.difference")}</span><span className="font-bold">{egp(result.difference)}</span></div>
        <div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${RECON_COLOR[result.status]}`}>
            {result.status}
          </span>
        </div>
      </div>
    </AppShell>
  );
}
