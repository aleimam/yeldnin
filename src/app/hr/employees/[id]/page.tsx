import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { formatBizDate } from "@/lib/format/dates";
import { getEmployee, managerOptions, canManageEmployee } from "@/lib/hr/hr-service";
import { leaveBalance, listAbsences } from "@/lib/hr/attendance-service";
import { ymd } from "@/lib/hr/attendance-logic";
import { EmployeeManage } from "../../EmployeeManage";
import { AttendancePanel } from "../../AttendancePanel";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const { id } = await params;
  const emp = await getEmployee(Number(id));
  if (!emp) notFound();
  const isSelf = emp.user?.id === access.user.id;
  const canManage = await canManageEmployee(access, emp.id);
  if (!isSelf && !canManage && !access.canModule("human_resources", "VIEW")) redirect("/");
  const t = await getT();
  const managers = canManage ? await managerOptions(emp.id) : [];
  const hrYear = new Date().getUTCFullYear();
  const balance = canManage ? await leaveBalance(emp.id, hrYear) : null;
  const absences = canManage ? await listAbsences(emp.id, hrYear) : [];

  const detail = (label: string, value: React.ReactNode) =>
    value ? <div><span className="text-muted">{label}: </span><span className="text-ink">{value}</span></div> : null;

  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={emp.user?.name ?? `#${emp.id}`} backHref="/hr/employees">
      <div className="max-w-3xl space-y-6">
        {/* Identity */}
        <div className="card p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            {detail(t("hr.uid"), emp.uid)}
            {detail(t("hr.email"), emp.user?.email)}
            {detail(t("hr.phone"), emp.user?.primaryPhone)}
            {detail(t("hr.tier"), emp.user?.tier ? t(`tier.${emp.user.tier}`) : null)}
            {detail(t("hr.hiringDate"), emp.hiringDate ? formatBizDate(emp.hiringDate) : null)}
            {emp.user?.active === false && <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("products.inactive")}</span>}
          </div>
        </div>

        {/* HR details */}
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("hr.details")}</h2>
          <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {detail(t("hr.nationalId"), emp.nationalIdNumber)}
            {detail(t("hr.idExpiry"), emp.nationalIdExpiry ? formatBizDate(emp.nationalIdExpiry) : null)}
            {detail(t("hr.degree"), emp.gradDegree)}
            {detail(t("hr.university"), emp.gradUniversity)}
            {detail(t("hr.faculty"), emp.gradFaculty)}
            {detail(t("hr.birthDate"), emp.birthDate ? formatBizDate(emp.birthDate) : null)}
          </div>
          {emp.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{emp.notes}</p>}
          {emp.photos.length > 0 && (
            <div className="mt-4">
              <div className="label mb-1">{t("hr.documents")}</div>
              <div className="flex flex-wrap gap-2">
                {emp.photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={p.id} href={assetUrl(p.assetId)!} target="_blank" rel="noreferrer" title={`${t(`hr.photoKind.${p.kind}`)}${p.label ? ` · ${p.label}` : ""}`}>
                    <img src={assetUrl(p.assetId)!} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Manager + reports */}
        <div className="card p-5 text-sm">
          <div>{detail(t("hr.manager"), emp.lineManager ? <Link href={`/hr/employees/${emp.lineManager.id}`} className="text-brand hover:underline">{emp.lineManager.user?.name}</Link> : "—")}</div>
          {emp.reports.length > 0 && (
            <div className="mt-2">
              <span className="text-muted">{t("hr.reports")}: </span>
              {emp.reports.map((r, i) => (
                <span key={r.id}>{i > 0 && ", "}<Link href={`/hr/employees/${r.id}`} className="text-brand hover:underline">{r.user?.name}</Link></span>
              ))}
            </div>
          )}
        </div>

        {canManage && <EmployeeManage employeeId={emp.id} managers={managers} initial={{
          nationalIdNumber: emp.nationalIdNumber ?? "",
          nationalIdExpiry: emp.nationalIdExpiry ? emp.nationalIdExpiry.toISOString().slice(0, 10) : "",
          gradDegree: emp.gradDegree ?? "",
          gradUniversity: emp.gradUniversity ?? "",
          gradFaculty: emp.gradFaculty ?? "",
          birthDate: emp.birthDate ? emp.birthDate.toISOString().slice(0, 10) : "",
          hiringDate: emp.hiringDate ? emp.hiringDate.toISOString().slice(0, 10) : "",
          notes: emp.notes ?? "",
          lineManagerId: emp.lineManagerId ? String(emp.lineManagerId) : "",
        }} />}

        {canManage && balance && (
          <AttendancePanel
            employeeId={emp.id}
            balance={balance}
            annualOverride={emp.annualAllowance}
            urgentOverride={emp.urgentAllowance}
            absences={absences.map((a) => ({ date: ymd(a.date), coveredByUrgent: a.coveredByUrgent, note: a.note }))}
          />
        )}

        {/* Life-events */}
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("hr.lifeEvents")}</h2>
          <ol className="space-y-2">
            {emp.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-line/60 py-1.5 text-sm">
                <span className="whitespace-nowrap text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</span>
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t(`hr.event.${e.type}`)}</span>
                <span className="text-ink">{e.message}</span>
                {e.photos.length > 0 && (
                  <span className="flex gap-1">
                    {e.photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={p.id} href={assetUrl(p.assetId)!} target="_blank" rel="noreferrer"><img src={assetUrl(p.assetId)!} alt="" className="h-8 w-8 rounded object-cover" /></a>
                    ))}
                  </span>
                )}
              </li>
            ))}
            {emp.events.length === 0 && <li className="text-sm text-muted">—</li>}
          </ol>
        </div>
      </div>
    </AppShell>
  );
}
