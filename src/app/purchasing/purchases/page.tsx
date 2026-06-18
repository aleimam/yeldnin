import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes } from "@/lib/products/products-logic";
import { listPurchases } from "@/lib/purchasing/purchasing-service";
import { categoryCountsByContainerHistory } from "@/lib/items/items-service";
import { categoryLabels, emptyCategoryCounts } from "@/lib/items/items-logic";
import { worstSlaByCurrentContainer } from "@/lib/sla/sla-service";
import { slaRowClass } from "@/lib/sla/sla-logic";
import { ItemCounts } from "@/components/ItemCounts";

export default async function PurchasesPage() {
  const access = await requireModule("purchasing", "VIEW");
  const scopes = productScopes(access, "VIEW");
  const canBuy = access.can("purchasing", "operate");
  const [t, rows] = await Promise.all([getT(), listPurchases({ scopes })]);
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
      <div className="card overflow-x-auto">
        <table className="w-full table-cards">
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
                  <div className="font-mono text-xs text-muted">{p.uid ?? p.id} · {p.country}</div>
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
    </AppShell>
  );
}
