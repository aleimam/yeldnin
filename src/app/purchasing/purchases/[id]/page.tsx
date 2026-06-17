import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { productScopes } from "@/lib/products/products-logic";
import { getPurchase, getPurchaseItems } from "@/lib/purchasing/purchasing-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("purchasing", "VIEW");
  const scopes = productScopes(access, "VIEW");
  const { id } = await params;
  const purchase = await getPurchase(Number(id));
  if (!purchase || !scopes.includes(purchase.scope as never)) notFound();
  const [t, locale, items, wf] = await Promise.all([getT(), getLocale(), getPurchaseItems(purchase.id), getWorkflow()]);
  const loc = locale === "ar" ? "ar" : "en";

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={purchase.uid ?? `#${purchase.id}`} backHref="/purchasing/purchases">
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div><span className="text-muted">{t("requests.scope")}: </span><span className="text-ink">{t(`scope.${purchase.scope}`)}</span></div>
            <div><span className="text-muted">{t("purchasing.country")}: </span><span className="text-ink">{purchase.country}</span></div>
            <div><span className="text-muted">{t("purchasing.supplier")}: </span><span className="text-ink">{purchase.supplierName ?? "—"}</span></div>
            <div><span className="text-muted">{t("purchasing.destination")}: </span><span className="text-ink">{purchase.destinationName ?? "—"}</span></div>
            <div><span className="text-muted">{t("purchasing.price")}: </span><span className="text-ink">{purchase.purchasePrice ?? "—"}</span></div>
            <div><span className="text-muted">{t("purchasing.status")}: </span><span className="text-ink">{purchase.status}</span></div>
          </div>
          {purchase.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{purchase.notes}</p>}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("requests.items")} ({items.length})</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line"><th className="th">{t("requests.uid")}</th><th className="th">{t("requests.product")}</th><th className="th">{t("requests.status")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="td font-mono text-xs text-muted">{it.uid ?? it.id}</td>
                  <td className="td"><Link href={`/products/${it.product.id}`} className="text-brand hover:underline">{it.product.name}</Link></td>
                  <td className="td">{wf.label(it.status as ItemStatus, loc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
