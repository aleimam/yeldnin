import Link from "next/link";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCarriersPaged } from "@/lib/carriers/carriers-service";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { ListSearch } from "@/components/ListSearch";

// Carriers are Logistics master data (shipping companies). Gated by the logistics
// module permission — VIEW to browse, OPERATE to add/edit.
export default async function CarriersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("logistics", "VIEW");
  const canManage = access.canModule("logistics", "OPERATE");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }] = await Promise.all([getT(), listCarriersPaged({ search: sp.q, skip, take })]);
  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("carriers.title")}
      backHref="/logistics"
      actions={canManage ? <Link href="/carriers/new" className="btn-primary">+ {t("carriers.new")}</Link> : null}
    >
      <ListSearch basePath="/carriers" value={sp.q ?? ""} placeholder={t("carriers.searchPlaceholder")} />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("carriers.name")}</th>
              <th className="th">{t("carriers.contact")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-canvas/60">
                <td className="td" data-label={t("carriers.name")}>
                  <Link href={`/carriers/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link>
                  {!c.active && <span className="ms-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("carriers.inactive")}</span>}
                </td>
                <td className="td text-muted" data-label={t("carriers.contact")}>{c.contact ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={2}>{t("carriers.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/carriers" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
