"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { updatePurchaseAction } from "./actions";

/** Edit a purchase's metadata (country, supplier, price, notes) — only while it's not on the website. */
export function PurchaseEditForm({
  id,
  initial,
  suppliers,
  countries,
}: {
  id: number;
  initial: { country: string; supplierId: number | null; purchasePrice: number | null; notes: string };
  suppliers: { id: number; label: string }[];
  countries: string[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [country, setCountry] = useState(initial.country);
  const [supplierId, setSupplierId] = useState(initial.supplierId ? String(initial.supplierId) : "");
  const [purchasePrice, setPurchasePrice] = useState(initial.purchasePrice != null ? String(initial.purchasePrice) : "");
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState("");

  function save() {
    setError("");
    start(async () => {
      const res = await updatePurchaseAction(id, {
        country,
        supplierId: supplierId ? Number(supplierId) : null,
        purchasePrice: purchasePrice.trim() === "" ? null : Number(purchasePrice),
        notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/purchasing/purchases/${id}`);
      router.refresh();
    });
  }

  return (
    <form className="card max-w-xl space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div>
        <label className="label">{t("purchasing.country")}</label>
        <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
          {country && !countries.includes(country) && <option value={country}>{country}</option>}
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label">{t("purchasing.supplier")}</label>
        <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">—</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">{t("purchasing.price")}</label>
        <input type="number" step="0.01" className="input" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
      </div>
      <div>
        <label className="label">{t("purchasing.notes")}</label>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "…" : t("common.save")}</button>
        <button type="button" onClick={() => router.push(`/purchasing/purchases/${id}`)} className="btn-secondary">{t("common.cancel")}</button>
      </div>
    </form>
  );
}
