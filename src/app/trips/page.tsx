import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listTrips } from "@/lib/trips/trip-service";
import { TripApproveButtons } from "./TripApproveButtons";
import { formatBizDate } from "@/lib/format/dates";

export default async function TripsPage() {
  const access = await requireModule("logistics", "VIEW");
  const canManage = access.canModule("logistics", "OPERATE");
  const [t, rows] = await Promise.all([getT(), listTrips()]);
  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("trip.title")}
      actions={canManage ? <Link href="/trips/new" className="btn-primary">+ {t("trip.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("trip.traveler")}</th>
              <th className="th">{t("trip.country")}</th>
              <th className="th">{t("trip.lastReceiving")}</th>
              <th className="th">{t("trip.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((tr) => (
              <tr key={tr.id} className="hover:bg-canvas/60">
                <td className="td"><Link href={`/trips/${tr.id}`} className="text-brand hover:underline">{tr.traveler.name}</Link></td>
                <td className="td text-muted">{tr.country}</td>
                <td className="td text-muted">{formatBizDate(tr.lastReceivingDate)}</td>
                <td className="td">
                  {tr.status === "NEW" && access.isAdmin
                    ? <TripApproveButtons id={tr.id} />
                    : t(`tripstatus.${tr.status}`)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("trip.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
