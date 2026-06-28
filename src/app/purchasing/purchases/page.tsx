import Link from "next/link";
import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes } from "@/lib/products/products-logic";
import { listPurchasesPaged } from "@/lib/purchasing/purchasing-service";
import { categoryCountsByContainerHistory } from "@/lib/items/items-service";
import { categoryLabels, emptyCategoryCounts } from "@/lib/items/items-logic";
import { worstSlaByCurrentContainer } from "@/lib/sla/sla-service";
import { slaRowClass } from "@/lib/sla/sla-logic";
import { ItemCounts } from "@/components/ItemCounts";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { PurchasesFilters } from "./PurchasesFilters";

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("purchasing", "VIEW");
  const scopes = productScopes(access, "VIEW");
  const canBuy = access.can("purchasing", "operate");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }] = await Promise.all([
    getT(),
    listPurchasesPaged({ scopes, search: sp.q, status: sp.status, skip, take }),
  ]);
  const ids = rows.map((r) => r.id);
  const [counts, sla] = await Promise.all([
    categoryCountsByContainerHistory("PURCHASE", ids),
    worstSlaByCurrentContainer("PURCHASE", ids),
  ]);
  const labels = categoryLabels(t);

  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("purchasing.purchases")}
      actions={canBuy ? <Link href="/purchasing/purchases/new" className="btn-primary">+ {t("purchasing.new")}</Link> : null}
    >
      <PurchasesFilters basePath="/purchasing/purchases" current={{ q: sp.q ?? "", status: sp.status ?? "" }} />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("purchasing.purchase")}</th>
              <th className="th">{t("requests.scope")}</th>
              <th className="th">{t("requests.items")}</th>
              <th className="th">{t("purchasing.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className={`hover:bg-canvas/60 ${slaRowClass(sla.get(p.id))}`}>
                <td className="td" data-label={t("purchasing.purchase")}>
                  <Link href={`/purchasing/purchases/${p.id}`} className="text-brand hover:underline">
                    {t("purchase.friendly", { count: counts.get(p.id)?.total ?? 0, supplier: p.supplierName ?? "—", dest: p.destinationName ?? "—" })}
                  </Link>
                  <div className="font-mono text-xs text-muted">{p.country}</div>
                </td>
                <td className="td text-muted" data-label={t("requests.scope")}>{t(`scope.${p.scope}`)}</td>
                <td className="td" data-label={t("requests.items")}><ItemCounts counts={counts.get(p.id) ?? emptyCategoryCounts()} labels={labels} /></td>
                <td className="td" data-label={t("purchasing.status")}>{t(`purchasestatus.${p.status}`)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("purchasing.noPurchases")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/purchasing/purchases" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
