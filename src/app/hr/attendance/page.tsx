import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { pendingApprovals, getHrConfig, listHolidays, teamsForBonus } from "@/lib/hr/attendance-service";
import { LeaveDecideButtons } from "./LeaveDecideButtons";
import { HrConfigForm } from "./HrConfigForm";
import { HolidayManager } from "./HolidayManager";

export default async function AttendancePage() {
  const access = await requireUser();
  const t = await getT();
  const canAdmin = access.isAdmin || access.can("human_resources", "manage");
  const approvals = await pendingApprovals(access);
  const cfg = canAdmin ? await getHrConfig() : null;
  const holidays = canAdmin ? await listHolidays() : [];
  const teams = canAdmin ? await teamsForBonus() : [];

  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("hr.attendance")} backHref="/hr">
      <div className="max-w-3xl space-y-6">
        <div className="card overflow-x-auto p-0">
          <div className="border-b border-line bg-canvas px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("leave.pending")} ({approvals.length})</div>
          <table className="w-full text-sm" data-cards>
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="th">{t("leave.employee")}</th>
                <th className="th">{t("leave.type")}</th>
                <th className="th">{t("leave.from")}</th>
                <th className="th">{t("leave.to")}</th>
                <th className="th text-end">{t("leave.days")}</th>
                <th className="th text-end">{t("leave.decide")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {approvals.map((r) => (
                <tr key={r.id}>
                  <td className="td" data-label={t("leave.employee")}>{r.employeeName}</td>
                  <td className="td" data-label={t("leave.type")}>{t(`leave.${r.type === "ANNUAL" ? "annual" : "urgent"}`)}</td>
                  <td className="td text-muted" data-datecol data-label={t("leave.from")}>{formatBizDate(r.startDate)}</td>
                  <td className="td text-muted" data-datecol data-label={t("leave.to")}>{formatBizDate(r.endDate)}</td>
                  <td className="td text-end" data-label={t("leave.days")}>{r.days}{r.reason ? <span className="block text-[10px] text-muted">{r.reason}</span> : null}</td>
                  <td className="td text-end"><LeaveDecideButtons id={r.id} /></td>
                </tr>
              ))}
              {approvals.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("leave.noPending")}</td></tr>}
            </tbody>
          </table>
        </div>

        {canAdmin && cfg && <HrConfigForm annualDefault={cfg.annualDefault} urgentDefault={cfg.urgentDefault} weeklyOffDays={cfg.weeklyOffDays} />}
        {canAdmin && (
          <HolidayManager
            teams={teams}
            holidays={holidays.map((h) => ({
              id: h.id,
              title: h.title,
              type: h.type,
              dateLabel: formatBizDate(h.startDate) + (h.startDate.getTime() !== h.endDate.getTime() ? ` – ${formatBizDate(h.endDate)}` : ""),
              bonuses: h.bonuses.map((b) => ({ teamId: b.teamId, amountPerDay: b.amountPerDay })),
            }))}
          />
        )}
      </div>
    </AppShell>
  );
}
