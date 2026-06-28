import Link from "next/link";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { isDocStatus, isReviewDue, canEditContent } from "@/lib/documents/documents-logic";
import { listDocumentsForUser, listDocCategories } from "@/lib/documents/documents-service";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { DocumentsFilters } from "./DocumentsFilters";
import { DocStatusBadge } from "./DocStatusBadge";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireUser();
  const v = { isAdmin: access.isAdmin, userId: access.user.id, userTeamKeys: access.user.teamKeys };
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });

  const categoryId = sp.category ? Number(sp.category) || undefined : undefined;
  const status = isDocStatus(sp.status) ? sp.status : undefined;
  const SORT_KEYS = ["title", "category", "status", "created", "updated"] as const;
  const sort = (SORT_KEYS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as (typeof SORT_KEYS)[number]) : "updated";
  const dir = sp.dir === "asc" ? "asc" : "desc";

  const [t, categories, { rows, total }] = await Promise.all([
    getT(),
    listDocCategories(),
    listDocumentsForUser(v, { search: sp.q, categoryId, status, skip, take, sort, dir }),
  ]);

  // Clickable column header → set sort key (toggling direction on re-click), resetting to page 1.
  const sortHref = (key: string) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (sp.category) p.set("category", sp.category);
    if (sp.status) p.set("status", sp.status);
    if (sp.perPage) p.set("perPage", sp.perPage);
    p.set("sort", key);
    p.set("dir", sort === key && dir === "desc" ? "asc" : "desc");
    return `/documents?${p.toString()}`;
  };
  const arrow = (key: string) => (sort === key ? (dir === "desc" ? " ↓" : " ↑") : "");

  const actions = (
    <div className="flex items-center gap-2">
      {access.isAdmin && <Link href="/documents/letterhead" className="btn-secondary btn-sm">{t("docs.letterhead.nav")}</Link>}
      {access.isAdmin && <Link href="/documents/categories" className="btn-secondary btn-sm">{t("docs.categories")}</Link>}
      <Link href="/documents/new" className="btn-primary btn-sm">+ {t("docs.new")}</Link>
    </div>
  );

  return (
    <AppShell access={access} moduleKey="documents" pageTitle={t("docs.title")} actions={actions}>
      <DocumentsFilters
        basePath="/documents"
        current={{ q: sp.q ?? "", category: sp.category ?? "", status: sp.status ?? "" }}
        categories={categories}
      />
      <table className="w-full" data-cards>
        <thead>
          <tr className="border-b border-line">
            <th className="th"><Link href={sortHref("title")} className="hover:text-brand">{t("docs.col.title")}{arrow("title")}</Link></th>
            <th className="th"><Link href={sortHref("category")} className="hover:text-brand">{t("docs.col.category")}{arrow("category")}</Link></th>
            <th className="th">{t("docs.col.kind")}</th>
            <th className="th"><Link href={sortHref("status")} className="hover:text-brand">{t("docs.col.status")}{arrow("status")}</Link></th>
            <th className="th"><Link href={sortHref("created")} className="hover:text-brand">{t("docs.col.created")}{arrow("created")}</Link></th>
            <th className="th"><Link href={sortHref("updated")} className="hover:text-brand">{t("docs.col.updated")}{arrow("updated")}</Link></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="td" data-label={t("docs.col.title")}>
                <Link href={`/documents/${d.id}`} className="text-brand hover:underline">{d.title}</Link>
                {isReviewDue(d.reviewBy) && canEditContent(d.level) && (
                  <span className="ms-2 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600">{t("docs.reviewDue")}</span>
                )}
              </td>
              <td className="td text-muted" data-label={t("docs.col.category")}>{d.categoryName ?? "—"}</td>
              <td className="td text-muted" data-label={t("docs.col.kind")}>{t(`docs.kind.${d.kind}`)}</td>
              <td className="td" data-label={t("docs.col.status")}><DocStatusBadge status={d.status} label={t(`docs.status.${d.status}`)} /></td>
              <td className="td text-muted" data-label={t("docs.col.created")}>{formatBizDate(d.creationDate ?? d.createdAt)}</td>
              <td className="td text-muted" data-label={t("docs.col.updated")}>{formatBizDate(d.updatedAt)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td className="td text-muted" colSpan={6}>{t("docs.empty")}</td></tr>
          )}
        </tbody>
      </table>
      <Paginator basePath="/documents" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
