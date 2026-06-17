"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { createTripAction } from "./actions";

export function TripForm({ travelers, countries }: { travelers: { id: number; name: string }[]; countries: string[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    travelerId: travelers[0] ? String(travelers[0].id) : "",
    country: countries[0] ?? "",
    maxWeight: "",
    dealPricePerKg: "",
    lastReceivingDate: "",
    deliveryDateInEgypt: "",
    notes: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    start(async () => {
      const res = await createTripAction({
        travelerId: f.travelerId ? Number(f.travelerId) : null,
        country: f.country,
        maxWeight: f.maxWeight ? Number(f.maxWeight) : null,
        dealPricePerKg: f.dealPricePerKg ? Number(f.dealPricePerKg) : null,
        lastReceivingDate: f.lastReceivingDate || null,
        deliveryDateInEgypt: f.deliveryDateInEgypt || null,
        notes: f.notes || undefined,
      });
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
      <div><label className="label">{t("trip.notes")}</label><textarea className="input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : t("trip.create")}</button>
    </div>
  );
}
