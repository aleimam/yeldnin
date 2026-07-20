import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { formatEgp } from "@/lib/format/money";
import { getDeliveryFor, courierIdForUser, listCouriersForAssignment } from "@/lib/deliveries/deliveries-service";
import { piastresToEgp, isPrepaid, canOperateDeliveries, canSeeAllDeliveries, needsAttention } from "@/lib/deliveries/deliveries-logic";
import { StatusForm } from "./StatusForm";

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("couriers", "VIEW");
  const tier = access.user.tier;
  const { id } = await params;
  const ownCourierId = await courierIdForUser(access.user.id);

  // GOLDEN RULE (§5.1): the by-id path is the one that gets abused, so the
  // courier filter is applied in the QUERY. Someone else's delivery is a 404 —
  // identical to an id that doesn't exist, so this cannot be used to discover
  // which deliveries the rest of the business is running.
  const d = await getDeliveryFor(access, tier, ownCourierId, Number(id));
  if (!d) notFound();

  const [t, couriers] = await Promise.all([getT(), canSeeAllDeliveries(access, tier) ? listCouriersForAssignment() : Promise.resolve([])]);
  const collect = piastresToEgp(d.collectPiastres) ?? 0;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-end text-sm">{children}</span>
    </div>
  );

  return (
    <AppShell access={access} moduleKey="couriers" pageTitle={d.orderNumber} backHref="/deliveries">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-canvas px-2 py-0.5 text-xs">{t(`dlv.status.${d.status}`)}</span>
            {d.reviewFlag && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">🚩 {t("dlv.flagged")}</span>}
            {needsAttention(d.bounceCount) && (
              <span className="rounded bg-canvas px-2 py-0.5 text-xs text-muted">{t("dlv.attention").replace("{n}", String(d.bounceCount))}</span>
            )}
          </div>
          <Row label={t("dlv.uid")}>{d.uid}</Row>
          <Row label={t("dlv.customer")}>{d.customerName}</Row>
          {/* A courier sees the phone and full address — the restriction is WHICH
              deliveries he can open, never how much of one he can read. */}
          <Row label={t("dlv.phone")}>{d.customerPhone ?? "—"}</Row>
          <Row label={t("dlv.address")}>
            <span className="whitespace-pre-line">
              {[d.addressZone, d.addressSubArea].filter(Boolean).join(" · ")}
              {"\n"}
              {d.addressText}
            </span>
          </Row>
          {d.addressMapUrl && (
            <Row label={t("dlv.map")}>
              <a href={d.addressMapUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                {t("dlv.openMap")}
              </a>
            </Row>
          )}
          <Row label={t("dlv.promised")}>
            {formatBizDate(d.promisedDate)} {d.promisedSlot ?? ""}
          </Row>
          <Row label={t("dlv.courier")}>{d.courier?.name ?? t("dlv.unassigned")}</Row>
          <Row label={t("dlv.collect")}>{isPrepaid(d.collectPiastres, d.paymentMethod) ? t("dlv.prepaid") : formatEgp(collect)}</Row>
          {d.collectedPiastres != null && <Row label={t("dlv.collected")}>{formatEgp(piastresToEgp(d.collectedPiastres))}</Row>}
          {d.notes && <Row label={t("dlv.orderNote")}>{d.notes}</Row>}
          {d.courierNote && <Row label={t("dlv.note")}>{d.courierNote}</Row>}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">{t("dlv.lines")}</h2>
            <table className="w-full">
              <tbody className="divide-y divide-line">
                {d.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="td">
                      {l.name}
                      {l.sku && <span className="ms-2 text-xs text-muted">{l.sku}</span>}
                    </td>
                    <td className="td text-end">×{l.qty}</td>
                  </tr>
                ))}
                {d.lines.length === 0 && (
                  <tr>
                    <td className="td text-muted">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {canOperateDeliveries(access, tier) && (
            <StatusForm id={d.id} status={d.status} couriers={couriers} courierId={d.courierId} collectEgp={collect} />
          )}

          <div className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">{t("dlv.history")}</h2>
            <ul className="space-y-1.5">
              {d.events.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 text-sm">
                  <span>
                    {t(`dlv.status.${e.status}`)}
                    {e.reason && <span className="ms-2 text-xs text-muted">{t(`dlv.reason.${e.reason}`)}</span>}
                    {e.note && <span className="ms-2 text-xs text-muted">{e.note}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatBizDate(e.at)}</span>
                </li>
              ))}
              {d.events.length === 0 && <li className="text-sm text-muted">—</li>}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
