import { notFound } from "next/navigation";
import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { parseTypes } from "@/lib/travelers/travelers-logic";
import { getTraveler } from "@/lib/travelers/travelers-service";
import { listTripsByTraveler } from "@/lib/trips/trip-service";
import { formatBizDate } from "@/lib/format/dates";

export default async function TravelerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("logistics", "VIEW");
  const { id } = await params;
  const tr = await getTraveler(Number(id));
  if (!tr) notFound();
  const [t, trips] = await Promise.all([getT(), listTripsByTraveler(tr.id)]);
  const canEdit = access.can("logistics", "operate");
  const types = parseTypes(tr.allowedProductTypes);

  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={tr.name}
      backHref="/travelers"
      actions={canEdit ? <Link href={`/travelers/${tr.id}/edit`} className="btn-primary">{t("products.edit")}</Link> : null}
    >
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-sm">
            {tr.contact && <div><span className="text-muted">{t("travelers.contact")}: </span><span className="text-ink">{tr.contact}</span></div>}
            {types.length > 0 && <div><span className="text-muted">{t("travelers.allowedTypes")}: </span><span className="text-ink">{types.map((ty) => t(`ptype.${ty}`)).join(", ")}</span></div>}
            {tr.carriesMaleSupport && <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("travelers.maleSupport")}</span>}
            {tr.staticAddress && <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("travelers.staticAddress")}</span>}
            {tr.blacklisted && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">{t("travelers.blacklisted")}</span>}
            {!tr.active && <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("products.inactive")}</span>}
          </div>
          {tr.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{tr.notes}</p>}
          {tr.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tr.photos.map((ph) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={ph.assetId} href={assetUrl(ph.assetId)!} target="_blank" rel="noreferrer"><img src={assetUrl(ph.assetId)!} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" /></a>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("trip.title")} ({trips.length})</h2>
          {trips.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line"><th className="th">{t("trip.country")}</th><th className="th">{t("trip.lastReceiving")}</th><th className="th">{t("trip.status")}</th></tr></thead>
              <tbody className="divide-y divide-line">
                {trips.map((tp) => (
                  <tr key={tp.id}>
                    <td className="td"><Link href={`/trips/${tp.id}`} className="text-brand hover:underline">{tp.country}</Link></td>
                    <td className="td text-muted">{formatBizDate(tp.lastReceivingDate)}</td>
                    <td className="td">{t(`tripstatus.${tp.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
