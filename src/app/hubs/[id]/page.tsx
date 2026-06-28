import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { InquiryLauncher } from "@/components/inquiry/InquiryLauncher";
import { getT, getLocale } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { kg } from "@/lib/format/money";
import { getHub } from "@/lib/hubs/hubs-service";
import { currentContainerItems, inboundPendingItems, itemsProvenance } from "@/lib/items/items-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import { InventoryTable } from "@/components/logistics/InventoryTable";

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
  const prov = await itemsProvenance([...inventory, ...inbound].map((i) => i.id));
  const invWeight = inventory.reduce((s, i) => s + (i.product.weightG ?? 0), 0);
  const inboundWeight = inbound.reduce((s, i) => s + (i.product.weightG ?? 0), 0);
  const label = (s: Parameters<typeof wf.label>[0]) => wf.label(s, loc);

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={hub.name} backHref="/hubs">
      <div className="max-w-3xl space-y-6">
        <InquiryLauncher unitKind="HUB" unitId={hub.id} />
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
          <InventoryTable items={inventory} prov={prov} label={label} t={t} emptyKey="trip.noItems" />
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("trip.inboundTitle")} ({inbound.length} · {kg(inboundWeight)})</h2>
          <InventoryTable items={inbound} prov={prov} label={label} t={t} emptyKey="trip.noInbound" />
        </div>
      </div>
    </AppShell>
  );
}
