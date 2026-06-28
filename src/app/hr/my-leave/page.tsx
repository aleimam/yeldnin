import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { getEmployeeByUserId } from "@/lib/hr/hr-service";
import { leaveBalance, listMyRequests } from "@/lib/hr/attendance-service";
import { MyLeaveForm } from "./MyLeaveForm";

export default async function MyLeavePage() {
  const access = await requireUser();
  const emp = await getEmployeeByUserId(access.user.id);
  if (!emp) redirect("/");
  const year = new Date().getUTCFullYear();
  const [t, bal, requests] = await Promise.all([getT(), leaveBalance(emp.id, year), listMyRequests(emp.id)]);

  const card = (label: string, b: { remaining: number; allowance: number; used: number }) => (
    <div className="card p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{b.remaining}<span className="text-base text-muted"> / {b.allowance}</span></div>
      <div className="text-xs text-muted">{t("leave.used")}: {b.used}</div>
    </div>
  );

  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("leave.myLeave")} backHref="/hr">
      <div className="max-w-3xl space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {card(t("leave.annual"), bal.annual)}
          {card(t("leave.urgent"), bal.urgent)}
        </div>

        <MyLeaveForm />

        <div className="card overflow-x-auto p-0">
          <div className="border-b border-line bg-canvas px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("leave.myRequests")}</div>
          <table className="w-full text-sm" data-cards>
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="th">{t("leave.type")}</th>
                <th className="th">{t("leave.from")}</th>
                <th className="th">{t("leave.to")}</th>
                <th className="th text-end">{t("leave.days")}</th>
                <th className="th">{t("leave.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="td" data-label={t("leave.type")}>{t(`leave.${r.type === "ANNUAL" ? "annual" : "urgent"}`)}</td>
                  <td className="td text-muted" data-datecol data-label={t("leave.from")}>{formatBizDate(r.startDate)}</td>
                  <td className="td text-muted" data-datecol data-label={t("leave.to")}>{formatBizDate(r.endDate)}</td>
                  <td className="td text-end" data-label={t("leave.days")}>{r.days}</td>
                  <td className="td" data-label={t("leave.status")}>{t(`leavestatus.${r.status}`)}</td>
                </tr>
              ))}
              {requests.length === 0 && <tr><td className="td text-muted" colSpan={5}>—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
