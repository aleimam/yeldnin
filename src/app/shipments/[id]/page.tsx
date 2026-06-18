import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { getShipment, getShipmentItems } from "@/lib/operations/operations-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { ShipmentPhotosButton } from "../../operations/ShipmentPhotosButton";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("operations", "VIEW");
  const { id } = await params;
  const shipment = await getShipment(Number(id));
  if (!shipment) notFound();
  const canManage = access.can("operations", "operate");
  const [t, locale, items, wf] = await Promise.all([getT(), getLocale(), getShipmentItems(shipment.id), getWorkflow()]);
  const loc = locale === "ar" ? "ar" : "en";

  return (
    <AppShell access={access} moduleKey="operations" pageTitle={shipment.uid ?? `#${shipment.id}`} backHref="/shipments">
      <div className="max-w-3xl space-y-6">
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div><span className="text-muted">{t("shipments.scope")}: </span><span className="text-ink">{t(`scope.${shipment.scope}`)}</span></div>
            <div><span className="text-muted">{t("shipments.status")}: </span><span className="text-ink">{t(`shipmentstatus.${shipment.status}`)}</span></div>
          </div>
          {canManage && <ShipmentPhotosButton id={shipment.id} status={shipment.status} />}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("shipments.items")} ({items.length})</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line"><th className="th">{t("shipments.uid")}</th><th className="th">{t("requests.product")}</th><th className="th">{t("requests.status")}</th></tr></thead>
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
