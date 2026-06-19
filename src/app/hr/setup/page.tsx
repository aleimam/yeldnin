import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listSalaryComponents, listDayTypes, getHrConfig } from "@/lib/hr/attendance-service";
import { SetupEditors } from "./SetupEditors";

export default async function HrSetupPage() {
  const access = await requireUser();
  if (!access.isAdmin && !access.can("human_resources", "manage")) redirect("/hr");
  const [t, components, dayTypes, cfg] = await Promise.all([getT(), listSalaryComponents(), listDayTypes(), getHrConfig()]);
  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("hr.setup")} backHref="/hr">
      <div className="max-w-3xl">
        <SetupEditors
          components={components.map((c) => ({ id: c.id, code: c.code, name: c.name, kind: c.kind, system: c.system }))}
          dayTypes={dayTypes.map((d) => ({ id: d.id, code: d.code, name: d.name, nameAr: d.nameAr, dayClass: d.dayClass, bonusComponentId: d.bonusComponentId, penaltyComponentId: d.penaltyComponentId, system: d.system }))}
          mapping={{ dutyEidDays: cfg.dutyEidDays, dutyEidVacation: cfg.dutyEidVacation, dutyVacation: cfg.dutyVacation, dutyWeekend: cfg.dutyWeekend }}
        />
      </div>
    </AppShell>
  );
}
