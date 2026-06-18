import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { getHub } from "@/lib/hubs/hubs-service";
import { currentContainerItems, inboundPendingItems } from "@/lib/items/items-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";

export default async function HubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  if (!access.canModule("logistics", "VIEW")) redirect("/");
  const { id } = await params;
  const hub = await getHub(Number(id));
  if (!hub) notFound();
  const canEdit = access.can("logistics", "operate");
  const [t, locale, inventory, inbound, wf] = await Promise.all([
    getT(),
    getLocale(),
    currentContainerItems("HUB", hub.id),
    inboundPendingItems("HUB", hub.id),
    getWorkflow(),
  ]);
  const loc = locale === "ar" ? "ar" : "en";
  const kg = (g: number) => `${(g / 1000).toFixed(1)} kg`;
  const invWeight = inventory.reduce((s, i) => s + (i.product.weightG ?? 0), 0);
  const inboundWeight = inbound.reduce((s, i) => s + (i.product.weightG ?? 0), 0);

  const ItemTable = ({ items }: { items: typeof inventory }) => (
    <table className="w-full text-sm" data-cards>
      <thead>
        <tr className="border-b border-line">
          <th className="th">{t("hubs.uid")}</th>
          <th className="th">{t("requests.product")}</th>
          <th className="th">{t("requests.status")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {items.map((it) => (
          <tr key={it.id}>
            <td className="td font-mono text-xs text-muted" data-label={t("hubs.uid")}>{it.uid ?? it.id}</td>
            <td className="td" data-label={t("requests.product")}><Link href={`/products/${it.product.id}`} className="text-brand hover:underline">{it.product.name}</Link></td>
            <td className="td" data-label={t("requests.status")}>{wf.label(it.status as ItemStatus, loc)}</td>
          </tr>
        ))}
        {items.length === 0 && <tr><td className="td text-muted" colSpan={3}>{t("trip.noItems")}</td></tr>}
      </tbody>
    </table>
  );

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={hub.name} backHref="/hubs">
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <div><span className="text-muted">{t("hubs.uid")}: </span><span className="font-mono text-ink">{hub.uid ?? hub.id}</span></div>
              <div><span className="text-muted">{t("hubs.country")}: </span><span className="text-ink">{hub.country}</span></div>
              <div><span className="text-muted">{t("trip.total")}: </span><span className="text-ink">{inventory.length + inbound.length} · {kg(invWeight + inboundWeight)}</span></div>
              {!hub.active && <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("hubs.inactive")}</span>}
            </div>
            {canEdit && <Link href={`/hubs/${hub.id}/edit`} className="btn-secondary px-3 py-1.5 text-sm">{t("common.edit")}</Link>}
          </div>
          {hub.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{hub.notes}</p>}
          {hub.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {hub.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={p.id} href={assetUrl(p.assetId)!} target="_blank" rel="noreferrer"><img src={assetUrl(p.assetId)!} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" /></a>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("trip.inventory")} ({inventory.length} · {kg(invWeight)})</h2>
          <ItemTable items={inventory} />
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("trip.inboundTitle")} ({inbound.length} · {kg(inboundWeight)})</h2>
          <ItemTable items={inbound} />
        </div>
      </div>
    </AppShell>
  );
}
