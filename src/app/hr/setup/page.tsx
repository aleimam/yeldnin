import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listSalaryComponents, listDayTypes, getHrConfig } from "@/lib/hr/attendance-service";
import { listSalaryTypes, listEmployeeTypes } from "@/lib/hr/employment-types-service";
import { prisma } from "@/lib/db";
import { SetupEditors } from "./SetupEditors";

export default async function HrSetupPage() {
  const access = await requireUser();
  if (!access.isAdmin && !access.can("human_resources", "manage")) redirect("/hr");
  const [t, components, dayTypes, cfg, teamRows, salaryTypes, employeeTypes] = await Promise.all([
    getT(), listSalaryComponents(), listDayTypes(), getHrConfig(),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listSalaryTypes(), listEmployeeTypes(),
  ]);
  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("hr.setup")} backHref="/hr">
      <div className="max-w-3xl">
        <SetupEditors
          components={components.map((c) => ({ id: c.id, code: c.code, name: c.name, nameAr: c.nameAr, kind: c.kind, valuation: c.valuation, defaultAmount: c.defaultAmount, system: c.system }))}
          dayTypes={dayTypes.map((d) => ({ id: d.id, code: d.code, name: d.name, nameAr: d.nameAr, dayClass: d.dayClass, bonusComponentId: d.bonusComponentId, penaltyComponentId: d.penaltyComponentId, system: d.system }))}
          mapping={{ dutyEidDays: cfg.dutyEidDays, dutyEidVacation: cfg.dutyEidVacation, dutyVacation: cfg.dutyVacation, dutyWeekend: cfg.dutyWeekend }}
          teams={teamRows}
          salaryTypes={salaryTypes.map((s) => ({ id: s.id, name: s.name, nameAr: s.nameAr }))}
          employeeTypes={employeeTypes.map((e) => ({ id: e.id, name: e.name, nameAr: e.nameAr, payrollEligible: e.payrollEligible }))}
        />
      </div>
    </AppShell>
  );
}
