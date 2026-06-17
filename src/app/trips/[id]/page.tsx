import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { getTrip, getTripItems } from "@/lib/trips/trip-service";
import { getTripMarks } from "@/lib/review/review-service";
import { teamsUserCanMark, REVIEW_TEAMS } from "@/lib/review/review-logic";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { TripAdvanceButton } from "../TripAdvanceButton";
import { TripApproveButtons } from "../TripApproveButtons";
import { TripOpsButtons } from "@/app/operations/TripOpsButtons";
import { TripReview } from "@/app/operations/TripReview";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("logistics", "VIEW");
  const { id } = await params;
  const trip = await getTrip(Number(id));
  if (!trip) notFound();
  const canManage = access.canModule("logistics", "OPERATE");
  const canOps = access.canModule("operations", "OPERATE");
  const [t, locale, items, wf] = await Promise.all([getT(), getLocale(), getTripItems(trip.id), getWorkflow()]);
  const loc = locale === "ar" ? "ar" : "en";

  // 3-team review (only once picked up). Each team sees its own mark; admins all.
  const editableTeams = teamsUserCanMark(access);
  const showReview = trip.status === "PICKED_UP";
  const allMarks = showReview ? await getTripMarks(trip.id) : [];
  const displayTeams = access.isAdmin ? [...REVIEW_TEAMS] : editableTeams;
  const reviewMarks = allMarks
    .filter((m) => displayTeams.includes(m.team as (typeof REVIEW_TEAMS)[number]))
    .map((m) => ({ team: m.team, status: m.status, note: m.note, photos: m.photos.map((p) => ({ id: p.assetId, url: assetUrl(p.assetId)! })) }));

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
            <div className="flex items-center gap-3">
              {trip.status === "NEW" && access.isAdmin && <TripApproveButtons id={trip.id} />}
              {trip.status === "APPROVED" && <span className="text-sm text-muted">{t("trip.autoShipNote")}</span>}
              {canManage && <TripAdvanceButton id={trip.id} status={trip.status} />}
              {canOps && <TripOpsButtons tripId={trip.id} status={trip.status} />}
            </div>
          </div>
          {trip.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{trip.notes}</p>}
        </div>

        {showReview && (
          <TripReview
            tripId={trip.id}
            displayTeams={displayTeams}
            editableTeams={editableTeams}
            marks={reviewMarks}
            isAdmin={access.isAdmin}
            converted={trip._count.shipments > 0}
          />
        )}

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("trip.items")} ({items.length})</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line"><th className="th">{t("trip.uid")}</th><th className="th">{t("requests.product")}</th><th className="th">{t("requests.status")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="td font-mono text-xs text-muted">{it.uid ?? it.id}</td>
                  <td className="td"><Link href={`/products/${it.product.id}`} className="text-brand hover:underline">{it.product.name}</Link></td>
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
