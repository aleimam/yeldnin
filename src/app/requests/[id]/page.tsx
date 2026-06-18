import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatBizDate } from "@/lib/format/dates";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { requestScopes, primaryRequestModule } from "@/lib/requests/request-logic";
import { getRequest, getRequestItems } from "@/lib/requests/request-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { DeliverButton } from "../DeliverButton";
import { slaForRequestItems } from "@/lib/sla/sla-service";
import { SlaBadge } from "@/components/SlaBadge";
import { canSeeSellingPrice } from "@/lib/products/products-logic";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const visible = requestScopes(access, "VIEW");
  if (!visible.length) redirect("/");
  const { id } = await params;
  const req = await getRequest(Number(id));
  if (!req || !visible.includes(req.scope as never)) notFound();
  const [t, locale, items, wf] = await Promise.all([getT(), getLocale(), getRequestItems(req.id), getWorkflow()]);
  const canDeliver = req.scope === "XOONX" && access.can("xoonx", "operate");
  const canSeeSelling = canSeeSellingPrice(access);
  const isSpecial = req.type === "SPECIAL_ORDER";
  const slaMap = await slaForRequestItems(items, req.deliveredAt);

  return (
    <AppShell access={access} moduleKey={primaryRequestModule(access)} pageTitle={req.uid ?? `#${req.id}`} backHref="/requests">
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div><span className="text-muted">{t("requests.type")}: </span><span className="text-ink">{t(`reqtype.${req.type}`)}</span></div>
            <div><span className="text-muted">{t("requests.scope")}: </span><span className="text-ink">{t(`scope.${req.scope}`)}</span></div>
            {req.customer && <div><span className="text-muted">{t("requests.customer")}: </span><span className="text-ink">{req.customer.name}</span></div>}
            {isSpecial && req.deposit != null && <div><span className="text-muted">{t("requests.deposit")}: </span><span className="text-ink">{req.deposit.toLocaleString()} EGP</span></div>}
          </div>
          {req.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{req.notes}</p>}
          {req.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {req.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={p.id} href={assetUrl(p.assetId)!} target="_blank" rel="noreferrer"><img src={assetUrl(p.assetId)!} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" /></a>
              ))}
            </div>
          )}
          {canDeliver && (
            <div className="mt-4 border-t border-line/60 pt-3">
              <DeliverButton id={req.id} deliveredAt={req.deliveredAt ? req.deliveredAt.toISOString() : null} />
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("requests.products")}</h2>
          <table className="w-full text-sm table-cards">
            <thead><tr className="border-b border-line"><th className="th">{t("requests.product")}</th><th className="th text-end">{t("requests.count")}</th>{canSeeSelling && <th className="th text-end">{t("requests.sell")}</th>}<th className="th text-end">{t("requests.buy")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {req.lines.map((l) => (
                <tr key={l.id}>
                  <td className="td" data-label={t("requests.product")}><Link href={`/products/${l.product.id}`} className="text-brand hover:underline">{l.product.name}</Link></td>
                  <td className="td text-end" data-label={t("requests.count")}>{l.count}</td>
                  {canSeeSelling && <td className="td text-end text-muted" data-label={t("requests.sell")}>{l.sellingPrice ?? "—"}</td>}
                  <td className="td text-end text-muted" data-label={t("requests.buy")}>{l.purchasePrice ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("requests.items")} ({items.length})</h2>
          <table className="w-full text-sm table-cards">
            <thead>
              <tr className="border-b border-line">
                <th className="th">{t("requests.uid")}</th>
                <th className="th">{t("requests.product")}</th>
                <th className="th">{t("requests.status")}</th>
                {isSpecial && <th className="th">{t("sla.promised")}</th>}
                {isSpecial && <th className="th">{t("sla.expected")}</th>}
                {isSpecial && <th className="th">SLA</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => {
                const s = slaMap.get(it.id);
                return (
                  <tr key={it.id}>
                    <td className="td font-mono text-xs text-muted" data-label={t("requests.uid")}>{it.uid ?? it.id}</td>
                    <td className="td" data-label={t("requests.product")}><Link href={`/products/${it.product.id}`} className="text-brand hover:underline">{it.product.name}</Link></td>
                    <td className="td" data-label={t("requests.status")}>{wf.salesLabel(it.status as ItemStatus, it.isSpecialOrder, locale === "ar" ? "ar" : "en")}</td>
                    {isSpecial && <td className="td text-muted" data-label={t("sla.promised")}>{s ? formatBizDate(s.promised) : "—"}</td>}
                    {isSpecial && <td className="td text-muted" data-label={t("sla.expected")}>{s ? formatBizDate(s.expected) : "—"}</td>}
                    {isSpecial && <td className="td" data-label="SLA">{s ? <SlaBadge status={s.status} label={t(`sla.${s.status.toLowerCase()}`)} /> : "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
