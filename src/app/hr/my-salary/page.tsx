import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { myStructure } from "@/lib/hr/salary-service";
import { SalaryPanel } from "../SalaryPanel";

export default async function MySalaryPage() {
  const access = await requireUser();
  const t = await getT();
  const data = await myStructure(access.user.id);

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
      </div>
    </AppShell>
  );
}
