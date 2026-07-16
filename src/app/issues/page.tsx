import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listIssuesPaged } from "@/lib/issues/issues-service";
import { issueVisibility } from "@/lib/issues/issues-logic";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { ListSearch } from "@/components/ListSearch";

export default async function IssuesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("issues", "VIEW");
  // Issue visibility is domain-scoped and Sales is barred (blueprint). A user
  // with no qualifying domain sees nothing — bounce them out entirely.
  const vis = issueVisibility(access);
  if (!vis) redirect("/");
  const canManage = access.can("issues", "operate");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }] = await Promise.all([
    getT(),
    listIssuesPaged({ scopeFilter: vis, status: sp.status, search: sp.q, skip, take }),
  ]);
  return (
    <AppShell
      access={access}
      moduleKey="issues"
      pageTitle={t("issues.title")}
      actions={canManage ? <Link href="/issues/new" className="btn-primary">+ {t("issues.new")}</Link> : null}
    >
      <ListSearch basePath="/issues" value={sp.q ?? ""} placeholder={t("issues.searchPlaceholder")} extra={{ status: sp.status }} />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("issues.titleField")}</th>
              <th className="th">{t("issues.status")}</th>
              <th className="th text-end">{t("issues.comps")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((i) => (
              <tr key={i.id} className={i.status === "SOLVED" ? "opacity-60" : "hover:bg-canvas/60"}>
                <td className="td" data-label={t("issues.titleField")}>
                  <Link href={`/issues/${i.id}`} className="font-medium text-brand hover:underline">{i.title}</Link>
                </td>
                <td className="td" data-label={t("issues.status")}>
                  {i.status === "OPEN" ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">{t("issues.open")}</span>
                  ) : (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">{t("issues.solved")}</span>
                  )}
                </td>
                <td className="td text-end text-muted" data-label={t("issues.comps")}>{i._count.compensations}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={3}>{t("issues.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/issues" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
