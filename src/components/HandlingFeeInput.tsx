"use client";
import { useT } from "@/i18n/client";
import { HANDLING_CURRENCIES } from "@/lib/fx/fx-logic";

/** Amount + currency input for a container's single handling-fee total. */
export function HandlingFeeInput({
  fee,
  currency,
  onFee,
  onCurrency,
}: {
  fee: string;
  currency: string;
  onFee: (v: string) => void;
  onCurrency: (v: string) => void;
}) {
  const t = useT();
  return (
    <div>
      <label className="label">{t("fx.handlingFee")}</label>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          className="input flex-1"
          value={fee}
          onChange={(e) => onFee(e.target.value)}
          placeholder="0"
        />
        <select className="input w-28" value={currency} onChange={(e) => onCurrency(e.target.value)}>
          {HANDLING_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
