import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { formatBizDate } from "@/lib/format/dates";
import { getEmployee, managerOptions, canManageEmployee } from "@/lib/hr/hr-service";
import { listPositions } from "@/lib/hr/positions-service";
import { listSalaryTypes, listEmployeeTypes } from "@/lib/hr/employment-types-service";
import { leaveBalance, listAbsences, dutyDayTypes, listDuties } from "@/lib/hr/attendance-service";
import { listStructure, eligibleComponents, listChanges } from "@/lib/hr/salary-service";
import { payrollForEmployee } from "@/lib/hr/payroll-service";
import { ymd } from "@/lib/hr/attendance-logic";
import { EmployeeManage } from "../../EmployeeManage";
import { AttendancePanel } from "../../AttendancePanel";
import { SalaryPanel } from "../../SalaryPanel";
import { PayrollPanel } from "../../PayrollPanel";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const { id } = await params;
  const emp = await getEmployee(Number(id));
  if (!emp) notFound();
  const isSelf = emp.user?.id === access.user.id;
  const canManage = await canManageEmployee(access, emp.id);
  if (!isSelf && !canManage && !access.canModule("human_resources", "VIEW")) redirect("/");
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const managers = canManage ? await managerOptions(emp.id) : [];
  const positions = canManage ? await listPositions() : [];
  const salaryTypes = canManage ? await listSalaryTypes() : [];
  const employeeTypes = canManage ? await listEmployeeTypes() : [];
  const posName = (p: { title: string; titleAr: string | null }) => (locale === "ar" && p.titleAr ? p.titleAr : p.title);
  const typeName = (x: { name: string; nameAr: string | null } | null | undefined) => (x ? (locale === "ar" && x.nameAr ? x.nameAr : x.name) : null);
  const deptNames = emp.user?.teamMembers?.map((m) => m.team.name).join(", ") || null; // department(s) = team membership
  const hrYear = new Date().getUTCFullYear();
  const balance = canManage ? await leaveBalance(emp.id, hrYear) : null;
  const absences = canManage ? await listAbsences(emp.id, hrYear) : [];
  const dutyTypeList = canManage ? await dutyDayTypes() : [];
  const duties = canManage ? await listDuties(emp.id, hrYear) : [];
  const structure = canManage ? await listStructure(emp.id) : null;
  const eligible = canManage ? await eligibleComponents(emp.id) : [];
  const salaryChanges = canManage ? await listChanges(emp.id) : [];
  const payroll = canManage ? await payrollForEmployee(emp.id) : null;

  const detail = (label: string, value: React.ReactNode) =>
    value ? <div><span className="text-muted">{label}: </span><span className="text-ink">{value}</span></div> : null;

  return (
    <AppShell
      access={access}
      moduleKey="human_resources"
      pageTitle={emp.user?.name ?? `#${emp.id}`}
      backHref="/hr/employees"
      actions={access.can("user_access", "manageUsers") ? <Link href={`/users/${emp.userId}`} className="btn-secondary btn-sm">{t("hr.userAccount")}</Link> : null}
    >
      <div className="max-w-3xl space-y-6">
        {/* Identity */}
        <div className="card p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            {detail(t("hr.uid"), emp.user?.uid)}
            {detail(t("hr.email"), emp.user?.email)}
            {detail(t("hr.phone"), emp.user?.primaryPhone)}
            {detail(t("hr.tier"), emp.user?.tier ? t(`tier.${emp.user.tier}`) : null)}
            {detail(t("hr.position"), emp.position ? posName(emp.position) : null)}
            {detail(t("hr.department"), deptNames)}
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
            {detail(t("hr.gender"), emp.gender === "MALE" ? t("hr.male") : emp.gender === "FEMALE" ? t("hr.female") : null)}
            {detail(t("hr.salaryType"), typeName(emp.salaryType))}
            {detail(t("hr.employeeType"), typeName(emp.employeeType))}
            {detail(t("hr.bank"), emp.bank)}
            {detail(t("hr.accountNo"), emp.accountNo)}
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
          gender: emp.gender ?? "",
          hiringDate: emp.hiringDate ? emp.hiringDate.toISOString().slice(0, 10) : "",
          bank: emp.bank ?? "",
          accountNo: emp.accountNo ?? "",
          salaryTypeId: emp.salaryTypeId ? String(emp.salaryTypeId) : "",
          employeeTypeId: emp.employeeTypeId ? String(emp.employeeTypeId) : "",
          notes: emp.notes ?? "",
          lineManagerId: emp.lineManagerId ? String(emp.lineManagerId) : "",
        }} identity={{
          name: emp.user?.name ?? "", nameAr: emp.user?.nameAr ?? "", fullName: emp.user?.fullName ?? "", fullNameAr: emp.user?.fullNameAr ?? "",
          email: emp.user?.email ?? "", uid: emp.user?.uid ?? "",
          primaryPhone: emp.user?.primaryPhone ?? "", secondaryPhone: emp.user?.secondaryPhone ?? "", yeldnPhone: emp.user?.yeldnPhone ?? "",
          positionId: emp.positionId ? String(emp.positionId) : "",
        }} positions={positions.map((p) => ({ id: p.id, label: posName(p) }))}
        salaryTypes={salaryTypes.map((s) => ({ id: s.id, label: typeName(s) ?? s.name }))}
        employeeTypes={employeeTypes.map((e) => ({ id: e.id, label: typeName(e) ?? e.name }))} />}

        {canManage && balance && (
          <AttendancePanel
            employeeId={emp.id}
            balance={balance}
            annualOverride={emp.annualAllowance}
            urgentOverride={emp.urgentAllowance}
            absences={absences.map((a) => ({ date: ymd(a.date), coveredByUrgent: a.coveredByUrgent, note: a.note }))}
            dutyTypes={dutyTypeList.map((d) => ({ id: d.id, label: `${d.code} · ${d.name}` }))}
            duties={duties.map((d) => ({ date: ymd(d.date), dayTypeCode: d.dayTypeCode, dayTypeName: d.dayTypeName, note: d.note }))}
          />
        )}

        {canManage && structure && (
          <SalaryPanel
            employeeId={emp.id}
            lines={structure.lines}
            monthlyBase={structure.monthlyBase}
            eligible={eligible.map((c) => ({ id: c.id, name: c.name, nameAr: c.nameAr, kind: c.kind, valuation: c.valuation, defaultAmount: c.defaultAmount }))}
            changes={salaryChanges.map((c) => ({ id: c.id, date: formatBizDate(c.effectiveDate), changeType: c.changeType, delta: c.delta, oldAmount: c.oldAmount, newAmount: c.newAmount, reason: c.reason, componentName: c.componentName }))}
          />
        )}

        {canManage && payroll && (
          <PayrollPanel
            employeeId={emp.id}
            slips={payroll.slips.map((s) => ({
              id: s.id, year: s.year, month: s.month, status: s.status,
              earningsTotal: s.earningsTotal, bonusTotal: s.bonusTotal, penaltyTotal: s.penaltyTotal,
              gross: s.gross, net: s.net, workingDays: s.workingDays, dayOfBasic: s.dayOfBasic, dayOfTotal: s.dayOfTotal,
              lines: s.lines.map((l) => ({ id: l.id, kind: l.kind, source: l.source, label: l.label, amount: l.amount, detail: l.detail })),
            }))}
            targets={payroll.targets}
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
