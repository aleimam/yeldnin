import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { myStructure } from "@/lib/hr/salary-service";
import { myPayslips } from "@/lib/hr/payroll-service";
import { SalaryPanel } from "../SalaryPanel";
import { PayslipBreakdown } from "../PayslipBreakdown";

export default async function MySalaryPage() {
  const access = await requireUser();
  const t = await getT();
  const data = await myStructure(access.user.id);
  const payslips = await myPayslips(access.user.id);

  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("salary.mySalary")} backHref="/hr">
      <div className="max-w-3xl space-y-4">
        {!data ? (
          <div className="card p-5 text-sm text-muted">{t("leave.noEmployee")}</div>
        ) : (
          <SalaryPanel
            employeeId={data.employeeId}
            lines={data.lines}
            monthlyBase={data.monthlyBase}
            eligible={[]}
            changes={data.changes.map((c) => ({ id: c.id, date: formatBizDate(c.effectiveDate), changeType: c.changeType, delta: c.delta, oldAmount: c.oldAmount, newAmount: c.newAmount, reason: c.reason, componentName: c.componentName }))}
            readOnly
          />
        )}

        {payslips.length > 0 && (
          <div className="card space-y-4 p-5">
            <h2 className="font-semibold text-ink">{t("pay.title")}</h2>
            {payslips.map((s) => (
              <div key={s.id} className="rounded-lg border border-line p-4">
                <PayslipBreakdown
                  slip={{ id: s.id, year: s.year, month: s.month, status: s.status, earningsTotal: s.earningsTotal, bonusTotal: s.bonusTotal, penaltyTotal: s.penaltyTotal, gross: s.gross, net: s.net, workingDays: s.workingDays, dayOfBasic: s.dayOfBasic, dayOfTotal: s.dayOfTotal }}
                  lines={s.lines.map((l) => ({ id: l.id, kind: l.kind, source: l.source, label: l.label, amount: l.amount, detail: l.detail }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
