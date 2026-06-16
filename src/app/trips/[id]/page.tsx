import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { getTrip, getTripItems } from "@/lib/trips/trip-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { TripAdvanceButton } from "../TripAdvanceButton";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("logistics", "VIEW");
  const { id } = await params;
  const trip = await getTrip(Number(id));
  if (!trip) notFound();
  const canManage = access.canModule("logistics", "OPERATE");
  const [t, locale, items, wf] = await Promise.all([getT(), getLocale(), getTripItems(trip.id), getWorkflow()]);
  const loc = locale === "ar" ? "ar" : "en";

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={trip.uid ?? `#${trip.id}`} backHref="/trips">
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <div><span className="text-muted">{t("trip.traveler")}: </span><span className="text-ink">{trip.traveler.name}</span></div>
              <div><span className="text-muted">{t("trip.country")}: </span><span className="text-ink">{trip.country}</span></div>
              <div><span className="text-muted">{t("trip.lastReceiving")}: </span><span className="text-ink">{trip.lastReceivingDate ? trip.lastReceivingDate.toISOString().slice(0, 10) : "—"}</span></div>
              <div><span className="text-muted">{t("trip.status")}: </span><span className="text-ink">{t(`tripstatus.${trip.status}`)}</span></div>
            </div>
            {canManage && <TripAdvanceButton id={trip.id} status={trip.status} />}
          </div>
          {trip.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{trip.notes}</p>}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("trip.items")} ({items.length})</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line"><th className="th">{t("trip.uid")}</th><th className="th">{t("requests.product")}</th><th className="th">{t("requests.status")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="td font-mono text-xs text-muted">{it.uid ?? it.id}</td>
                  <td className="td">{it.product.name}</td>
                  <td className="td">{wf.label(it.status as ItemStatus, loc)}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td className="td text-muted" colSpan={3}>{t("trip.noItems")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
