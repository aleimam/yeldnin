import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listTrips } from "@/lib/trips/trip-service";

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
              <th className="th">{t("trip.uid")}</th>
              <th className="th">{t("trip.traveler")}</th>
              <th className="th">{t("trip.country")}</th>
              <th className="th">{t("trip.lastReceiving")}</th>
              <th className="th">{t("trip.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((tr) => (
              <tr key={tr.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted">
                  <Link href={`/trips/${tr.id}`} className="text-brand hover:underline">{tr.uid ?? tr.id}</Link>
                </td>
                <td className="td">{tr.traveler.name}</td>
                <td className="td text-muted">{tr.country}</td>
                <td className="td text-muted">{tr.lastReceivingDate ? tr.lastReceivingDate.toISOString().slice(0, 10) : "—"}</td>
                <td className="td">{t(`tripstatus.${tr.status}`)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("trip.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
