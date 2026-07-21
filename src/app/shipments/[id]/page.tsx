import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { FlagItemsControl } from "@/app/exceptions/FlagItemsControl";
import { AppShell } from "@/components/shell/AppShell";
import { InquiryLauncher } from "@/components/inquiry/InquiryLauncher";
import { getT, getLocale } from "@/i18n/server";
import { getShipment, getShipmentItems, getShipmentPhotos } from "@/lib/operations/operations-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { ShipmentPhotosButton } from "../../operations/ShipmentPhotosButton";
import { ShipmentStockEntry } from "../../operations/ShipmentStockEntry";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("operations", "VIEW");
  const { id } = await params;
  const shipment = await getShipment(Number(id));
  if (!shipment) notFound();
  const canManage = access.can("operations", "operate");
  const [t, locale, items, wf, photos] = await Promise.all([
    getT(), getLocale(), getShipmentItems(shipment.id), getWorkflow(), getShipmentPhotos(shipment.id),
  ]);
  const loc = locale === "ar" ? "ar" : "en";
  // Serialise for the client component (Dates → ISO, workflow label resolved
  // here because the workflow config is server-side only).
  const entryItems = items.map((it) => ({
    id: it.id,
    uid: it.uid,
    productId: it.product.id,
    productName: it.product.name,
    statusLabel: wf.label(it.status as ItemStatus, loc),
    expiryDate: it.expiryDate ? it.expiryDate.toISOString() : null,
    lotCode: it.lotCode,
  }));
  // Handing over units with no expiry would give Veeey's Sales nothing to
  // review, so the In-Website step is blocked until they're all entered.
  const missingExpiry = entryItems.filter((i) => !i.expiryDate).length;

  return (
    <AppShell access={access} moduleKey="operations" pageTitle={shipment.uid ?? `#${shipment.id}`} backHref="/shipments">
      <div className="max-w-3xl space-y-6">
        <InquiryLauncher unitKind="SHIPMENT" unitId={shipment.id} />
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div><span className="text-muted">{t("shipments.scope")}: </span><span className="text-ink">{t(`scope.${shipment.scope}`)}</span></div>
            <div><span className="text-muted">{t("shipments.status")}: </span><span className="text-ink">{t(`shipmentstatus.${shipment.status}`)}</span></div>
          </div>
          {canManage && <ShipmentPhotosButton id={shipment.id} status={shipment.status} missingExpiry={missingExpiry} />}
        </div>

        <ShipmentStockEntry shipmentId={shipment.id} items={entryItems} photos={photos} canManage={canManage} />

        {(canManage || access.isAdmin) && items.length > 0 && (
          <div className="card p-5">
            <FlagItemsControl items={items.map((it) => ({ id: it.id, label: `${it.product.name} ${it.uid ?? `#${it.id}`}` }))} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
