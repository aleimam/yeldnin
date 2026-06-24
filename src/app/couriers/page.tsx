import Link from "next/link";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCouriersPaged } from "@/lib/couriers/couriers-service";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { ListSearch } from "@/components/ListSearch";

export default async function CouriersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("couriers", "VIEW");
  const canManage = access.canModule("couriers", "OPERATE");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }] = await Promise.all([getT(), listCouriersPaged({ search: sp.q, skip, take })]);
  return (
    <AppShell
      access={access}
      moduleKey="couriers"
      pageTitle={t("couriers.title")}
      actions={canManage ? <Link href="/couriers/new" className="btn-primary">+ {t("couriers.new")}</Link> : null}
    >
      <ListSearch basePath="/couriers" value={sp.q ?? ""} placeholder={t("couriers.searchPlaceholder")} />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("couriers.uid")}</th>
              <th className="th">{t("couriers.name")}</th>
              <th className="th">{t("couriers.contact")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted" data-label={t("couriers.uid")}>{c.uid ?? c.id}</td>
                <td className="td" data-label={t("couriers.name")}>
                  <Link href={`/couriers/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link>
                  {!c.active && <span className="ms-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("couriers.inactive")}</span>}
                </td>
                <td className="td text-muted" data-label={t("couriers.contact")}>{c.contact ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={3}>{t("couriers.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/couriers" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
