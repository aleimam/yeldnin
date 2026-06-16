import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listIssues } from "@/lib/issues/issues-service";

export default async function IssuesPage() {
  const access = await requireModule("issues", "VIEW");
  const canManage = access.canModule("issues", "OPERATE");
  const [t, rows] = await Promise.all([getT(), listIssues()]);
  return (
    <AppShell
      access={access}
      moduleKey="issues"
      pageTitle={t("issues.title")}
      actions={canManage ? <Link href="/issues/new" className="btn-primary">+ {t("issues.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("issues.uid")}</th>
              <th className="th">{t("issues.titleField")}</th>
              <th className="th">{t("issues.status")}</th>
              <th className="th text-end">{t("issues.comps")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((i) => (
              <tr key={i.id} className={i.status === "SOLVED" ? "opacity-60" : "hover:bg-canvas/60"}>
                <td className="td font-mono text-xs text-muted">
                  <Link href={`/issues/${i.id}`} className="text-brand hover:underline">{i.uid ?? i.id}</Link>
                </td>
                <td className="td">{i.title}</td>
                <td className="td">
                  {i.status === "OPEN" ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">{t("issues.open")}</span>
                  ) : (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">{t("issues.solved")}</span>
                  )}
                </td>
                <td className="td text-end text-muted">{i._count.compensations}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("issues.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
