import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listTravelers } from "@/lib/travelers/travelers-service";

export default async function TravelersPage() {
  const access = await requireModule("logistics", "VIEW");
  const canManage = access.can("logistics", "operate");
  const [t, rows] = await Promise.all([getT(), listTravelers()]);
  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("travelers.title")}
      actions={canManage ? <Link href="/travelers/new" className="btn-primary">+ {t("travelers.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("travelers.uid")}</th>
              <th className="th">{t("travelers.name")}</th>
              <th className="th">{t("travelers.contact")}</th>
              <th className="th">{t("travelers.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((tr) => (
              <tr key={tr.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted">{tr.uid ?? "—"}</td>
                <td className="td">
                  <Link href={`/travelers/${tr.id}`} className="font-medium text-brand hover:underline">{tr.name}</Link>
                  {tr._count.photos > 0 && <span className="ms-2 text-xs text-muted">📎{tr._count.photos}</span>}
                </td>
                <td className="td text-muted">{tr.contact ?? "—"}</td>
                <td className="td">
                  {tr.blacklisted && <span className="me-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">{t("travelers.blacklisted")}</span>}
                  {!tr.active && <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("travelers.inactive")}</span>}
                  {tr.active && !tr.blacklisted && <span className="text-green-600">●</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("travelers.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
