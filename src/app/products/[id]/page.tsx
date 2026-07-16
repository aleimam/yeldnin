import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { productScopes, primaryProductModule, canSeeSellingPrice, canSeePurchasePrice } from "@/lib/products/products-logic";
import { productDetail } from "@/lib/products/products-service";
import { PRODUCT_STAGES } from "@/lib/items/items-logic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const visible = productScopes(access, "VIEW");
  if (!visible.length) redirect("/");
  const { id } = await params;
  const data = await productDetail(Number(id));
  if (!data || !visible.includes(data.product.scope as never)) notFound();
  const { product, stageStats, requests } = data;
  // The Containers card exposes hub/trip names, so it's Logistics-access only.
  const showContainers = access.isAdmin || access.canModule("logistics", "VIEW");
  const containers = access.hidesTripTraveler ? data.containers.filter((c) => c.type !== "TRIP") : data.containers;
  const t = await getT();
  const canEdit = productScopes(access, "OPERATE").includes(product.scope as never);
  const canSeeSelling = canSeeSellingPrice(access);
  const canSeePurchase = canSeePurchasePrice(access);

  return (
    <AppShell
      access={access}
      moduleKey={primaryProductModule(access)}
      pageTitle={product.name}
      backHref="/products"
      actions={canEdit ? <Link href={`/products/${product.id}/edit`} className="btn-primary">{t("products.edit")}</Link> : null}
    >
      <div className="max-w-4xl space-y-6">
        {/* Details */}
        <div className="card p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            {product.uid && <div><span className="text-muted">{t("products.uid")}: </span><span className="font-mono text-ink">{product.uid}</span></div>}
            <div><span className="text-muted">{t("products.scope")}: </span><span className="text-ink">{t(`scope.${product.scope}`)}</span></div>
            <div><span className="text-muted">{t("products.type")}: </span><span className="text-ink">{t(`ptype.${product.type}`)}</span></div>
            {product.originRegion && <div><span className="text-muted">{t("products.origin")}: </span><span className="text-ink">{product.originRegion}</span></div>}
            {product.defaultSupplier && <div><span className="text-muted">{t("products.supplier")}: </span><span className="text-ink">{product.defaultSupplier.name}</span></div>}
            {product.sku && <div><span className="text-muted">{t("products.sku")}: </span><span className="text-ink">{product.sku}</span></div>}
            {product.weightG != null && <div><span className="text-muted">{t("products.weight")}: </span><span className="text-ink">{product.weightG}</span></div>}
            {canSeePurchase && product.purchasePrice != null && <div><span className="text-muted">{t("products.purchasePrice")}: </span><span className="text-ink">{product.purchasePrice}</span></div>}
            {canSeeSelling && product.sellingPrice != null && <div><span className="text-muted">{t("products.sellingPrice")}: </span><span className="text-ink">{product.sellingPrice}</span></div>}
            {product.size && <div><span className="text-muted">{t("products.size")}: </span><span className="text-ink">{product.size}</span></div>}
            {product.grade && <div><span className="text-muted">{t("products.grade")}: </span><span className="text-ink">{product.grade}</span></div>}
            {!product.active && <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("products.inactive")}</span>}
          </div>
          {product.url && <p className="mt-2 text-sm"><a href={product.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">{product.url}</a></p>}
          {product.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{product.notes}</p>}
          {product.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {product.photos.map((ph) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={ph.assetId} href={assetUrl(ph.assetId)!} target="_blank" rel="noreferrer"><img src={assetUrl(ph.assetId)!} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" /></a>
              ))}
            </div>
          )}
        </div>

        {/* Item statistics — sales-facing journey stages (no hub/trip names) */}
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("products.stats")} ({stageStats.total})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-canvas p-3 text-center">
              <div className="text-2xl font-bold text-ink">{stageStats.requested}</div>
              <div className="text-xs text-muted">{t("pstage.requested")}</div>
            </div>
            <div className="rounded-lg bg-canvas p-3 text-center">
              <div className="text-2xl font-bold text-ink">{stageStats.purchased}</div>
              <div className="text-xs text-muted">{t("pstage.purchased")}</div>
            </div>
            <div className="rounded-lg bg-canvas p-3 text-center">
              <div className="text-2xl font-bold text-ink">{stageStats.hubs}</div>
              <div className="text-xs text-muted">{t("pstage.hubs")}</div>
            </div>
            <div className="rounded-lg bg-canvas p-3 text-center">
              <div className="text-2xl font-bold text-ink">{stageStats.globalShipping.total}</div>
              <div className="text-xs text-muted">{t("pstage.globalShipping")}</div>
              <div className="mt-1 text-[11px] text-muted">{t("pstage.transit")} {stageStats.globalShipping.transit} · {t("pstage.globalShipping")} {stageStats.globalShipping.globalShipping}</div>
            </div>
            <div className="rounded-lg bg-canvas p-3 text-center">
              <div className="text-2xl font-bold text-ink">{stageStats.inEgypt.total}</div>
              <div className="text-xs text-muted">{t("pstage.inEgypt")}</div>
              <div className="mt-1 text-[11px] text-muted">{t("pstage.customs")} {stageStats.inEgypt.customs} · {t("pstage.outForDelivery")} {stageStats.inEgypt.outForDelivery}</div>
            </div>
            <div className="rounded-lg bg-canvas p-3 text-center">
              <div className="text-2xl font-bold text-ink">{stageStats.stock}</div>
              <div className="text-xs text-muted">{t("pstage.stock")}</div>
            </div>
            <div className="rounded-lg bg-canvas p-3 text-center">
              <div className={`text-2xl font-bold ${stageStats.problems > 0 ? "text-red-600" : "text-ink"}`}>{stageStats.problems}</div>
              <div className="text-xs text-muted">{t("pstage.problems")}</div>
            </div>
          </div>
        </div>

        {/* Related requests */}
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("products.relatedRequests")} ({requests.length})</h2>
          {requests.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <table className="w-full text-sm" data-cards>
              <thead><tr className="border-b border-line"><th className="th">{t("requests.customer")}</th><th className="th">{t("requests.type")}</th><th className="th">{t("products.unitStages")}</th><th className="th text-end">{t("requests.count")}</th></tr></thead>
              <tbody className="divide-y divide-line">
                {requests.map((r, i) => (
                  <tr key={`${r.id}-${i}`}>
                    <td className="td" data-label={t("requests.customer")}><Link href={`/requests/${r.id}`} className="font-medium text-brand hover:underline">{r.customer ?? t(`reqtype.${r.type}`)}</Link></td>
                    <td className="td text-muted" data-label={t("requests.type")}>{t(`reqtype.${r.type}`)}</td>
                    <td className="td text-muted" data-label={t("products.unitStages")}>
                      {PRODUCT_STAGES.filter((s) => r.stages[s] > 0).map((s) => `${t(`pstage.${s}`)} ${r.stages[s]}`).join(" · ") || "—"}
                    </td>
                    <td className="td text-end" data-label={t("requests.count")}>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Containers — Logistics-access only (exposes hub/trip names) */}
        {showContainers && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("products.containers")} ({containers.length})</h2>
          {containers.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="divide-y divide-line/60 text-sm">
              {containers.map((c) => (
                <li key={`${c.type}:${c.id}`} className="flex items-center justify-between py-1.5">
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] uppercase text-muted">{t(`container.${c.type}`)}</span>
                    {c.href ? <Link href={c.href} className="text-brand hover:underline">{c.label}</Link> : <span className="text-ink">{c.label}</span>}
                  </span>
                  <span className="text-xs text-muted">{c.items} {t("products.units")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}
      </div>
    </AppShell>
  );
}
