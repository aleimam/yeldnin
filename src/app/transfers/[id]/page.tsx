import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { InquiryLauncher } from "@/components/inquiry/InquiryLauncher";
import { getT, getLocale } from "@/i18n/server";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { getTransfer, getTransferItems } from "@/lib/transfers/transfer-service";
import { TransferAdvanceButton } from "../TransferAdvanceButton";

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("logistics", "VIEW");
  const { id } = await params;
  const transfer = await getTransfer(Number(id));
  if (!transfer) notFound();
  const canManage = access.isAdmin || access.can("logistics", "operate");
  const [t, locale, items, wf] = await Promise.all([getT(), getLocale(), getTransferItems(transfer.id), getWorkflow()]);
  const loc = locale === "ar" ? "ar" : "en";

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={transfer.uid ?? `#${transfer.id}`} backHref="/transfers">
      <div className="max-w-3xl space-y-6">
        <InquiryLauncher unitKind="TRANSFER" unitId={transfer.id} />
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <div><span className="text-muted">{t("transfers.from")}: </span><span className="text-ink">{transfer.fromName ?? `${transfer.fromType} #${transfer.fromId}`}</span></div>
              <div><span className="text-muted">{t("transfers.to")}: </span><span className="text-ink">{transfer.toName ?? `${transfer.toType} #${transfer.toId}`}</span></div>
              <div><span className="text-muted">{t("transfers.country")}: </span><span className="text-ink">{transfer.country}</span></div>
              <div><span className="text-muted">{t("transfers.status")}: </span><span className="text-ink">{t(`transferstatus.${transfer.status}`)}</span></div>
              {transfer.carrier && <div><span className="text-muted">{t("transfers.carrier")}: </span><span className="text-ink">{transfer.carrier}</span></div>}
              {transfer.tracking && <div><span className="text-muted">{t("transfers.tracking")}: </span><span className="text-ink">{transfer.tracking}</span></div>}
            </div>
            {canManage && <TransferAdvanceButton id={transfer.id} status={transfer.status} />}
          </div>
          {transfer.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{transfer.notes}</p>}
          {transfer.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {transfer.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={p.id} href={`/api/asset/${p.assetId}`} target="_blank" rel="noreferrer"><img src={`/api/asset/${p.assetId}`} alt="" className="h-16 w-16 rounded object-cover" /></a>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("transfers.items")} ({items.length})</h2>
          <table className="w-full text-sm" data-cards>
            <thead><tr className="border-b border-line"><th className="th">{t("requests.uid")}</th><th className="th">{t("requests.product")}</th><th className="th">{t("requests.status")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="td font-mono text-xs text-muted" data-label={t("requests.uid")}>{it.uid ?? it.id}</td>
                  <td className="td" data-label={t("requests.product")}><Link href={`/products/${it.product.id}`} className="text-brand hover:underline">{it.product.name}</Link></td>
                  <td className="td" data-label={t("requests.status")}>{wf.label(it.status as ItemStatus, loc)}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td className="td text-muted" colSpan={3}>{t("transfers.noItems")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
