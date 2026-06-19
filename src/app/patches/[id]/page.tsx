import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { FlagItemsControl } from "@/app/exceptions/FlagItemsControl";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { getPatch, getPatchItems } from "@/lib/patches/patch-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { PatchStatusButtons } from "../PatchStatusButtons";
import { HandlingFeeDisplay } from "@/components/HandlingFeeDisplay";

export default async function PatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("logistics", "VIEW");
  const { id } = await params;
  const patch = await getPatch(Number(id));
  if (!patch) notFound();
  const canManage = access.can("logistics", "operate");
  const [t, locale, items, wf] = await Promise.all([getT(), getLocale(), getPatchItems(patch.id), getWorkflow()]);
  const loc = locale === "ar" ? "ar" : "en";

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("patch.friendly", { count: items.length, supplier: patch.supplierName ?? "—", dest: patch.destinationName ?? "—" })} backHref="/patches">
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <div><span className="text-muted">{t("patches.uid")}: </span><span className="font-mono text-ink">{patch.uid ?? patch.id}</span></div>
              <div><span className="text-muted">{t("patches.supplier")}: </span><span className="text-ink">{patch.supplierName ?? "—"} · {patch.country}</span></div>
              <div><span className="text-muted">{t("patches.destination")}: </span><span className="text-ink">{patch.destinationName ?? "—"}</span></div>
              <div><span className="text-muted">{t("patches.tracking")}: </span><span className="text-ink">{patch.tracking ?? "—"}</span></div>
              <div><span className="text-muted">{t("patches.courier")}: </span><span className="text-ink">{patch.courier ?? "—"}</span></div>
              <div><span className="text-muted">{t("fx.handlingFee")}: </span><HandlingFeeDisplay fee={patch.handlingFee} currency={patch.handlingFeeCurrency} /></div>
              <div><span className="text-muted">{t("patches.status")}: </span><span className="text-ink">{t(`patchstatus.${patch.status}`)}</span></div>
            </div>
            {canManage && <PatchStatusButtons id={patch.id} status={patch.status} />}
          </div>
          {patch.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{patch.notes}</p>}
          {patch.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {patch.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={p.id} href={assetUrl(p.assetId)!} target="_blank" rel="noreferrer"><img src={assetUrl(p.assetId)!} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" /></a>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("patches.items")} ({items.length})</h2>
          <table className="w-full text-sm" data-cards>
            <thead><tr className="border-b border-line"><th className="th">{t("patches.uid")}</th><th className="th">{t("requests.product")}</th><th className="th">{t("requests.status")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="td font-mono text-xs text-muted" data-label={t("patches.uid")}>{it.uid ?? it.id}</td>
                  <td className="td" data-label={t("requests.product")}><Link href={`/products/${it.product.id}`} className="text-brand hover:underline">{it.product.name}</Link></td>
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
        </div>
      </div>
    </AppShell>
  );
}
