import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { checkSalesBreakdown } from "@/lib/expenses/expenses-logic";
import { saveMonthlySalesAction } from "../actions";
import { ActionForm } from "@/components/ActionForm";

const FIELDS: [key: string, labelKey: string][] = [
  ["totalSales", "exp.totalSales"],
  ["cashToStaff", "exp.cashToStaff"],
  ["cashToAramex", "exp.cashToAramex"],
  ["cashToSmsa", "exp.cashToSmsa"],
  ["bankTransferAndMobileWallet", "exp.bankWallet"],
  ["creditCard", "exp.creditCard"],
];

export default async function MonthlySalesPage() {
  const access = await requireCapability("expenses", "manageAdmin");
  const t = await getT();
  const now = new Date();
  const reports = await prisma.monthlySalesReport.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 });

  return (
    <AppShell access={access} moduleKey="expenses" pageTitle={t("exp.monthlySales")}>
      <ActionForm action={saveMonthlySalesAction} className="card mb-6 grid max-w-2xl gap-4 p-6 sm:grid-cols-2" saveLabel={t("exp.save")} footerClassName="sm:col-span-2">
        <div><label className="label">{t("exp.year")}</label><input name="year" type="number" defaultValue={now.getFullYear()} className="input" /></div>
        <div><label className="label">{t("exp.month")}</label><input name="month" type="number" min="1" max="12" defaultValue={now.getMonth() + 1} className="input" /></div>
        {FIELDS.map(([k, lk]) => (
          <div key={k}><label className="label">{t(lk)}</label><input name={k} type="number" step="any" defaultValue="0" className="input" /></div>
        ))}
        <div className="sm:col-span-2"><label className="label">{t("exp.note")}</label><input name="note" className="input" /></div>
      </ActionForm>

      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr><th className="th">{t("exp.month")}</th><th className="th text-end">{t("exp.totalSales")}</th><th className="th">{t("exp.status")}</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reports.map((r) => {
              const chk = checkSalesBreakdown(r);
              return (
                <tr key={r.id}>
                  <td className="td" data-label={t("exp.month")}>{r.year}-{String(r.month).padStart(2, "0")}</td>
                  <td className="td text-end" data-label={t("exp.totalSales")}>{Math.round(r.totalSales).toLocaleString()}</td>
                  <td className="td" data-label={t("exp.status")}>{chk.matches ? <span className="text-green-600">{t("exp.breakdownOk")}</span> : <span className="text-amber-600">{t("exp.breakdownOff")} {Math.round(chk.difference).toLocaleString()}</span>}</td>
                </tr>
              );
            })}
            {reports.length === 0 && <tr><td className="td text-muted" colSpan={3}>—</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
