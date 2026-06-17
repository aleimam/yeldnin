import { getT } from "@/i18n/server";
import { handlingFeeInEgp } from "@/lib/fx/fx-service";
import { FX_BASE } from "@/lib/fx/fx-logic";

/** Read-only handling fee with its live EGP equivalent (server component). */
export async function HandlingFeeDisplay({ fee, currency }: { fee: number | null; currency: string | null }) {
  if (fee == null) return <span className="text-ink">—</span>;
  const t = await getT();
  const cur = (currency || FX_BASE).toUpperCase();
  const amount = `${fee.toLocaleString()} ${cur}`;
  if (cur === FX_BASE) return <span className="text-ink">{amount}</span>;
  const { egp, missing } = await handlingFeeInEgp(fee, currency);
  const equiv = missing ? t("fx.rateUnavailable") : `≈ ${Math.round(egp).toLocaleString()} ${FX_BASE}`;
  return (
    <span className="text-ink">
      {amount} <span className="text-muted">({equiv})</span>
    </span>
  );
}
