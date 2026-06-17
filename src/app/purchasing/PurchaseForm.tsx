"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/i18n/client";
import type { Scope } from "@/lib/products/products-logic";
import { createPurchaseAction } from "./actions";

interface PoolRow {
  scope: string;
  productId: number;
  productName: string;
  count: number;
}

export function PurchaseForm({
  allowedScopes,
  pool,
  suppliers,
  hubs,
  trips,
  countries,
}: {
  allowedScopes: Scope[];
  pool: PoolRow[];
  suppliers: { id: number; label: string }[];
  hubs: { id: number; name: string; country: string }[];
  trips: { id: number; name: string }[];
  countries: string[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<string>(allowedScopes[0] ?? "EGV");
  const [country, setCountry] = useState<string>(countries[0] ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [destinationType, setDestinationType] = useState("HUB");
  const [destinationId, setDestinationId] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<number, string>>({});

  const scopePool = pool.filter((p) => p.scope === scope);

  function submit() {
    setError(null);
    const lines = scopePool
      .map((p) => ({ productId: p.productId, count: Number(qty[p.productId]) || 0 }))
      .filter((l) => l.count >= 1);
    const payload = {
      scope,
      country,
      supplierId: supplierId ? Number(supplierId) : null,
      purchasePrice: purchasePrice ? Number(purchasePrice) : null,
      destinationType,
      destinationId: destinationId ? Number(destinationId) : null,
      notes: notes || undefined,
      lines,
    };
    start(async () => {
      const res = await createPurchaseAction(payload);
      if (res.ok) router.push(`/purchasing/purchases/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <div className="card max-w-3xl space-y-4 p-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* scope · country · supplier in one row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">{t("requests.scope")}</label>
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
            {allowedScopes.map((s) => <option key={s} value={s}>{t(`scope.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t("purchasing.country")}</label>
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t("purchasing.supplier")}</label>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{t("pricer.f.choose")}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* purchase price · destination type · destination in one row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">{t("purchasing.price")}</label>
          <input type="number" step="any" className="input" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("purchasing.destType")}</label>
          <select className="input" value={destinationType} onChange={(e) => { setDestinationType(e.target.value); setDestinationId(""); }}>
            <option value="HUB">{t("purchasing.destHub")}</option>
            <option value="TRIP">{t("purchasing.destTrip")}</option>
          </select>
        </div>
        <div>
          <label className="label">{t("purchasing.destination")}</label>
          <select className="input" value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
            <option value="">{destinationType === "HUB" ? t("purchasing.pickHub") : t("purchasing.pickTrip")}</option>
            {destinationType === "HUB"
              ? hubs.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.country})</option>)
              : trips.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">{t("purchasing.fromPool")}</label>
        {scopePool.length === 0 ? (
          <p className="text-sm text-muted">{t("purchasing.poolEmpty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line"><th className="th">{t("requests.product")}</th><th className="th text-end">{t("purchasing.pending")}</th><th className="th text-end">{t("purchasing.buyQty")}</th></tr></thead>
            <tbody className="divide-y divide-line">
              {scopePool.map((p) => (
                <tr key={p.productId}>
                  <td className="td"><Link href={`/products/${p.productId}`} className="text-brand hover:underline">{p.productName}</Link></td>
                  <td className="td text-end text-muted">{p.count}</td>
                  <td className="td text-end">
                    <input
                      type="number" min={0} max={p.count}
                      className="input ms-auto h-8 w-20 py-1 text-end"
                      value={qty[p.productId] ?? ""}
                      onChange={(e) => setQty((q) => ({ ...q, [p.productId]: e.target.value }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div><label className="label">{t("purchasing.notes")}</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

      <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : t("purchasing.create")}</button>
    </div>
  );
}
