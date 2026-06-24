import Link from "next/link";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listShipmentsPaged } from "@/lib/operations/operations-service";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { ListSearch } from "@/components/ListSearch";

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("operations", "VIEW");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }] = await Promise.all([getT(), listShipmentsPaged({ search: sp.q, skip, take })]);
  return (
    <AppShell access={access} moduleKey="operations" pageTitle={t("shipments.title")}>
      <ListSearch basePath="/shipments" value={sp.q ?? ""} placeholder={t("shipments.searchPlaceholder")} />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("shipments.uid")}</th>
              <th className="th">{t("shipments.scope")}</th>
              <th className="th">{t("shipments.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted" data-label={t("shipments.uid")}>
                  <Link href={`/shipments/${s.id}`} className="text-brand hover:underline">{s.uid ?? s.id}</Link>
                </td>
                <td className="td text-muted" data-label={t("shipments.scope")}>{t(`scope.${s.scope}`)}</td>
                <td className="td" data-label={t("shipments.status")}>{t(`shipmentstatus.${s.status}`)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={3}>{t("shipments.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/shipments" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
