import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes } from "@/lib/products/products-logic";
import { listPurchases } from "@/lib/purchasing/purchasing-service";

export default async function PurchasesPage() {
  const access = await requireModule("purchasing", "VIEW");
  const scopes = productScopes(access, "VIEW");
  const canBuy = access.canModule("purchasing", "OPERATE");
  const [t, rows] = await Promise.all([getT(), listPurchases({ scopes })]);

  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("purchasing.purchases")}
      actions={canBuy ? <Link href="/purchasing/purchases/new" className="btn-primary">+ {t("purchasing.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("purchasing.uid")}</th>
              <th className="th">{t("requests.scope")}</th>
              <th className="th">{t("purchasing.supplier")}</th>
              <th className="th">{t("purchasing.destination")}</th>
              <th className="th">{t("purchasing.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted">
                  <Link href={`/purchasing/purchases/${p.id}`} className="text-brand hover:underline">{p.uid ?? p.id}</Link>
                </td>
                <td className="td text-muted">{t(`scope.${p.scope}`)}</td>
                <td className="td text-muted">{p.supplierName ?? "—"} · {p.country}</td>
                <td className="td text-muted">{p.destinationName ?? "—"}</td>
                <td className="td">{p.status}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("purchasing.noPurchases")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
