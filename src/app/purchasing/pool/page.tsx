import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes } from "@/lib/products/products-logic";
import { pendingPool } from "@/lib/purchasing/purchasing-service";

export default async function PoolPage() {
  const access = await requireModule("purchasing", "VIEW");
  const scopes = productScopes(access, "VIEW");
  const canBuy = access.canModule("purchasing", "OPERATE");
  const [t, pool] = await Promise.all([getT(), pendingPool(scopes)]);

  return (
    <AppShell
      access={access}
      moduleKey="purchasing"
      pageTitle={t("purchasing.pool")}
      actions={canBuy && pool.length > 0 ? <Link href="/purchasing/purchases/new" className="btn-primary">+ {t("purchasing.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("requests.scope")}</th>
              <th className="th">{t("requests.product")}</th>
              <th className="th text-end">{t("purchasing.pending")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {pool.map((p) => (
              <tr key={`${p.scope}:${p.productId}`} className="hover:bg-canvas/60">
                <td className="td text-muted">{t(`scope.${p.scope}`)}</td>
                <td className="td">{p.productName}</td>
                <td className="td text-end font-medium">{p.count}</td>
              </tr>
            ))}
            {pool.length === 0 && <tr><td className="td text-muted" colSpan={3}>{t("purchasing.poolEmpty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
