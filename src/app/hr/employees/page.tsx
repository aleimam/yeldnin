import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listEmployees } from "@/lib/hr/hr-service";

export default async function EmployeesPage() {
  const access = await requireModule("human_resources", "VIEW");
  const [t, rows] = await Promise.all([getT(), listEmployees()]);
  const canCreate = access.isAdmin || access.can("human_resources", "operate");

  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("hr.employees")} backHref="/hr">
      <div className="space-y-4">
        {canCreate && (
          <div className="flex justify-end">
            <Link href="/hr/employees/new" className="btn-primary px-3 py-1.5 text-sm">+ {t("hr.addEmployee")}</Link>
          </div>
        )}
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm" data-cards>
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="th">{t("hr.name")}</th>
                <th className="th">{t("hr.email")}</th>
                <th className="th">{t("hr.manager")}</th>
                <th className="th text-end">{t("hr.reports")}</th>
                <th className="th">{t("hr.statusCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-canvas/60">
                  <td className="td" data-label={t("hr.name")}>
                    <Link href={`/hr/employees/${e.id}`} className="text-brand hover:underline">{e.user?.name ?? "—"}</Link>
                  </td>
                  <td className="td text-muted" data-label={t("hr.email")}>{e.user?.email}</td>
                  <td className="td text-muted" data-label={t("hr.manager")}>{e.lineManager?.user?.name ?? "—"}</td>
                  <td className="td text-end text-muted" data-label={t("hr.reports")}>{e._count.reports || "—"}</td>
                  <td className="td" data-label={t("hr.statusCol")}>{e.user?.active === false ? <span className="text-muted">{t("products.inactive")}</span> : "✓"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("hr.noEmployees")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
