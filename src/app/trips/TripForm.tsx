"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { createTripAction, updateTripAction } from "./actions";
import { PRODUCT_TYPES } from "@/lib/products/products-logic";
import { HandlingFeeInput } from "@/components/HandlingFeeInput";
import { FX_BASE } from "@/lib/fx/fx-logic";

export interface TripFormInitial {
  id: number;
  travelerId: number;
  country: string;
  maxWeight: number | null;
  dealPricePerKg: number | null;
  lastReceivingDate: string;
  deliveryDateInEgypt: string;
  notes: string;
  handlingFee: string;
  handlingFeeCurrency: string;
  allowedProductTypes: string[];
}

export function TripForm({
  travelers,
  countries,
  trip,
}: {
  travelers: { id: number; name: string }[];
  countries: string[];
  trip?: TripFormInitial;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    travelerId: trip ? String(trip.travelerId) : travelers[0] ? String(travelers[0].id) : "",
    country: trip?.country ?? countries[0] ?? "",
    maxWeight: trip?.maxWeight != null ? String(trip.maxWeight) : "",
    dealPricePerKg: trip?.dealPricePerKg != null ? String(trip.dealPricePerKg) : "",
    lastReceivingDate: trip?.lastReceivingDate ?? "",
    deliveryDateInEgypt: trip?.deliveryDateInEgypt ?? "",
    notes: trip?.notes ?? "",
    handlingFee: trip?.handlingFee ?? "",
    handlingFeeCurrency: trip?.handlingFeeCurrency || FX_BASE,
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [types, setTypes] = useState<string[]>(trip?.allowedProductTypes ?? []);
  const toggleType = (ty: string) => setTypes((p) => (p.includes(ty) ? p.filter((x) => x !== ty) : [...p, ty]));

  function submit() {
    setError(null);
    start(async () => {
      const payload = {
        travelerId: f.travelerId ? Number(f.travelerId) : null,
        country: f.country,
        maxWeight: f.maxWeight ? Number(f.maxWeight) : null,
        dealPricePerKg: f.dealPricePerKg ? Number(f.dealPricePerKg) : null,
        lastReceivingDate: f.lastReceivingDate || null,
        deliveryDateInEgypt: f.deliveryDateInEgypt || null,
        allowedProductTypes: types,
        notes: f.notes || undefined,
        handlingFee: f.handlingFee ? Number(f.handlingFee) : null,
        handlingFeeCurrency: f.handlingFee ? f.handlingFeeCurrency : null,
      };
      const res = trip ? await updateTripAction(trip.id, payload) : await createTripAction(payload);
      if (res.ok) router.push(`/trips/${res.id}`);
      else setError(res.error);
    });
  }

  if (!travelers.length) {
    return <div className="card p-6 text-sm text-muted">{t("trip.noTravelers")}</div>;
  }

  return (
    <div className="card max-w-2xl space-y-4 p-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">{t("trip.traveler")}</label>
          <select className="input" value={f.travelerId} onChange={(e) => set("travelerId", e.target.value)}>
            {travelers.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t("trip.country")}</label>
          <select className="input" value={f.country} onChange={(e) => set("country", e.target.value)}>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div><label className="label">{t("trip.maxWeight")}</label><input type="number" step="any" className="input" value={f.maxWeight} onChange={(e) => set("maxWeight", e.target.value)} /></div>
        <div><label className="label">{t("trip.dealPrice")}</label><input type="number" step="any" className="input" value={f.dealPricePerKg} onChange={(e) => set("dealPricePerKg", e.target.value)} /></div>
        <div><label className="label">{t("trip.lastReceiving")}</label><input type="date" className="input" value={f.lastReceivingDate} onChange={(e) => set("lastReceivingDate", e.target.value)} /></div>
        <div><label className="label">{t("trip.deliveryEgypt")}</label><input type="date" className="input" value={f.deliveryDateInEgypt} onChange={(e) => set("deliveryDateInEgypt", e.target.value)} /></div>
      </div>
      <div>
        <label className="label">{t("travelers.allowedTypes")}</label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <input type="checkbox" checked={types.length === PRODUCT_TYPES.length} onChange={(e) => setTypes(e.target.checked ? [...PRODUCT_TYPES] : [])} />
            {t("common.selectAll")}
          </label>
          {PRODUCT_TYPES.map((ty) => (
            <label key={ty} className="flex items-center gap-1.5 text-sm text-ink">
              <input type="checkbox" checked={types.includes(ty)} onChange={() => toggleType(ty)} />
              {t(`ptype.${ty}`)}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">{t("trip.typesHint")}</p>
      </div>
      <div className="sm:max-w-xs">
        <HandlingFeeInput fee={f.handlingFee} currency={f.handlingFeeCurrency} onFee={(v) => set("handlingFee", v)} onCurrency={(v) => set("handlingFeeCurrency", v)} />
      </div>
      <div><label className="label">{t("trip.notes")}</label><textarea className="input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : trip ? t("common.save") : t("trip.create")}</button>
    </div>
  );
}
