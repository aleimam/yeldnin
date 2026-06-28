import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { FlagItemsControl } from "@/app/exceptions/FlagItemsControl";
import { AppShell } from "@/components/shell/AppShell";
import { InquiryLauncher } from "@/components/inquiry/InquiryLauncher";
import { getT, getLocale } from "@/i18n/server";
import { productScopes } from "@/lib/products/products-logic";
import { getPurchase, getPurchaseItems } from "@/lib/purchasing/purchasing-service";
import { listScopedProducts } from "@/lib/requests/request-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { statusIndex } from "@/lib/items/items-logic";
import { PurchaseActions } from "../../PurchaseActions";
import { AddGiftForm } from "../../AddGiftForm";
import { HandlingFeeDisplay } from "@/components/HandlingFeeDisplay";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("purchasing", "VIEW");
  const scopes = productScopes(access, "VIEW");
  const { id } = await params;
  const purchase = await getPurchase(Number(id));
  if (!purchase || !scopes.includes(purchase.scope as never)) notFound();
  const [t, locale, items, wf, giftProducts] = await Promise.all([
    getT(),
    getLocale(),
    getPurchaseItems(purchase.id),
    getWorkflow(),
    listScopedProducts([purchase.scope]),
  ]);
  const loc = locale === "ar" ? "ar" : "en";
  const canManage = access.can("purchasing", "operate") || access.can("logistics", "operate");
  const onWebsite = items.some((it) => statusIndex(it.status as ItemStatus) >= statusIndex("WEBSITE"));
  const hasOrdered = items.some((it) => it.status === "ORDERED");

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("purchase.friendly", { count: items.length, supplier: purchase.supplierName ?? "—", dest: purchase.destinationName ?? "—" })} backHref="/purchasing/purchases">
      <div className="max-w-3xl space-y-6">
        <InquiryLauncher unitKind="PURCHASE" unitId={purchase.id} />
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <div><span className="text-muted">{t("purchasing.uid")}: </span><span className="font-mono text-ink">{purchase.uid ?? purchase.id}</span></div>
              <div><span className="text-muted">{t("requests.scope")}: </span><span className="text-ink">{t(`scope.${purchase.scope}`)}</span></div>
              <div><span className="text-muted">{t("purchasing.country")}: </span><span className="text-ink">{purchase.country}</span></div>
              <div><span className="text-muted">{t("purchasing.supplier")}: </span><span className="text-ink">{purchase.supplierName ?? "—"}</span></div>
              <div><span className="text-muted">{t("purchasing.destination")}: </span><span className="text-ink">{purchase.destinationName ?? "—"}</span></div>
              <div><span className="text-muted">{t("purchasing.price")}: </span><span className="text-ink">{purchase.purchasePrice ?? "—"}</span></div>
              <div><span className="text-muted">{t("fx.handlingFee")}: </span><HandlingFeeDisplay fee={purchase.handlingFee} currency={purchase.handlingFeeCurrency} /></div>
              <div><span className="text-muted">{t("purchasing.status")}: </span><span className="text-ink">{t(`purchasestatus.${purchase.status}`)}</span></div>
            </div>
            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                {!onWebsite && (
                  <Link href={`/purchasing/purchases/${purchase.id}/edit`} className="btn-secondary px-3 py-1.5 text-sm">{t("common.edit")}</Link>
                )}
                <PurchaseActions id={purchase.id} status={purchase.status} hasOrdered={hasOrdered} locked={onWebsite} />
              </div>
            )}
          </div>
          {purchase.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{purchase.notes}</p>}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("requests.items")} ({items.length})</h2>
          <table className="w-full text-sm" data-cards>
            <thead><tr className="border-b border-line"><th className="th">{t("requests.product")}</th><th className="th">{t("requests.status")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="td" data-label={t("requests.product")}>
                    <Link href={`/products/${it.product.id}`} className="prodname text-brand hover:underline">{it.product.name}</Link>
                    {it.isGift && <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">{t("purchasing.gift")}</span>}
                  </td>
                  <td className="td" data-label={t("requests.status")}>{wf.label(it.status as ItemStatus, loc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(canManage || access.isAdmin) && items.length > 0 && (
            <div className="mt-3">
              <FlagItemsControl items={items.map((it) => ({ id: it.id, label: `${it.product.name} ${it.uid ?? `#${it.id}`}` }))} />
            </div>
          )}
          {canManage && !onWebsite && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="label mb-2">{t("purchasing.addGift")}</p>
              <AddGiftForm purchaseId={purchase.id} products={giftProducts.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
