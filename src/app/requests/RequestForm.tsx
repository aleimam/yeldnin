"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { REQUEST_TYPES, requiresCustomer, allowsPhotos, expectedDeposit } from "@/lib/requests/request-logic";
import type { Scope } from "@/lib/products/products-logic";
import { createRequestAction } from "./actions";

interface Line {
  productId: string;
  count: string;
  sellingPrice: string;
  purchasePrice: string;
  purchaseCurrency: string;
  notes: string;
}
const blankLine = (): Line => ({ productId: "", count: "1", sellingPrice: "", purchasePrice: "", purchaseCurrency: "", notes: "" });

export function RequestForm({
  allowedScopes,
  products,
  customers,
  depositPct,
}: {
  allowedScopes: Scope[];
  products: { id: number; name: string; scope: string; sellingPrice: number | null; purchasePrice: number | null }[];
  customers: { id: number; name: string; scope: string }[];
  depositPct: number;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("RESTOCK");
  const [scope, setScope] = useState<string>(allowedScopes[0] ?? "EGV");
  const [customerId, setCustomerId] = useState("");
  const [newMode, setNewMode] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", contactNumber: "" });
  const [notes, setNotes] = useState("");
  const [deposit, setDeposit] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const isSpecial = requiresCustomer(type);
  const expected = expectedDeposit(
    depositPct,
    lines.map((l) => ({ count: Number(l.count) || 0, sellingPrice: l.sellingPrice ? Number(l.sellingPrice) : null })),
  );
  const scopeProducts = products.filter((p) => p.scope === scope);
  const scopeCustomers = customers.filter((c) => c.scope === scope);
  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  // Selecting a product copies its default selling/purchase price into the line.
  const pickProduct = (i: number, productId: string) => {
    const p = scopeProducts.find((sp) => String(sp.id) === productId);
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i
          ? {
              ...l,
              productId,
              sellingPrice: p?.sellingPrice != null ? String(p.sellingPrice) : l.sellingPrice,
              purchasePrice: p?.purchasePrice != null ? String(p.purchasePrice) : l.purchasePrice,
            }
          : l,
      ),
    );
  };

  function submit() {
    setError(null);
    const payload = {
      type,
      scope,
      customerId: isSpecial && !newMode && customerId ? Number(customerId) : null,
      newCustomer: isSpecial && newMode && newCust.name.trim() ? { name: newCust.name, contactNumber: newCust.contactNumber || undefined } : null,
      notes: notes || undefined,
      deposit: isSpecial && deposit ? Number(deposit) : null,
      lines: lines
        .filter((l) => l.productId)
        .map((l) => ({
          productId: Number(l.productId),
          count: Number(l.count) || 1,
          sellingPrice: l.sellingPrice ? Number(l.sellingPrice) : null,
          purchasePrice: l.purchasePrice ? Number(l.purchasePrice) : null,
          purchaseCurrency: l.purchaseCurrency || null,
          notes: l.notes || undefined,
        })),
      photoIds: isSpecial && allowsPhotos(type) ? photos.map((p) => p.id) : [],
    };
    start(async () => {
      const res = await createRequestAction(payload);
      if (res.ok) router.push(`/requests/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <div className="card max-w-3xl space-y-4 p-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">{t("requests.type")}</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {REQUEST_TYPES.map((ty) => <option key={ty} value={ty}>{t(`reqtype.${ty}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t("requests.scope")}</label>
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
            {allowedScopes.map((s) => <option key={s} value={s}>{t(`scope.${s}`)}</option>)}
          </select>
        </div>
      </div>

      {isSpecial && (
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">{t("requests.customer")}</label>
            <button type="button" onClick={() => setNewMode((v) => !v)} className="text-xs text-brand hover:underline">
              {newMode ? t("requests.pickExisting") : t("requests.addNew")}
            </button>
          </div>
          {newMode ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input" placeholder={t("customers.name")} value={newCust.name} onChange={(e) => setNewCust((p) => ({ ...p, name: e.target.value }))} />
              <input className="input" placeholder={t("customers.number")} value={newCust.contactNumber} onChange={(e) => setNewCust((p) => ({ ...p, contactNumber: e.target.value }))} />
            </div>
          ) : (
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{t("pricer.f.choose")}</option>
              {scopeCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label mb-0">{t("requests.products")}</label>
          <button type="button" onClick={() => setLines((p) => [...p, blankLine()])} className="text-xs text-brand hover:underline">
            + {t("requests.addLine")}
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-2 sm:grid-cols-12">
              <select className="input col-span-2 sm:col-span-4" value={l.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                <option value="">{t("requests.product")}…</option>
                {scopeProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" min={1} className="input sm:col-span-2" placeholder={t("requests.count")} value={l.count} onChange={(e) => setLine(i, "count", e.target.value)} />
              <input type="number" step="any" className="input sm:col-span-2" placeholder={t("requests.sell")} value={l.sellingPrice} onChange={(e) => setLine(i, "sellingPrice", e.target.value)} />
              <input type="number" step="any" className="input sm:col-span-2" placeholder={t("requests.buy")} value={l.purchasePrice} onChange={(e) => setLine(i, "purchasePrice", e.target.value)} />
              {scope === "XOONX" && (
                <select className="input sm:col-span-2" value={l.purchaseCurrency} onChange={(e) => setLine(i, "purchaseCurrency", e.target.value)} title={t("xreq.buyCurrency")}>
                  <option value="">EGP</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                </select>
              )}
              <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} disabled={lines.length === 1} className="text-sm text-red-600 hover:underline disabled:opacity-30 sm:col-span-2">
                {t("requests.removeLine")}
              </button>
            </div>
          ))}
        </div>
      </div>

      {isSpecial && (
        <div className="sm:max-w-xs">
          <label className="label">{t("requests.deposit")}</label>
          <input type="number" step="any" min="0" className="input" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          {expected > 0 && (
            <button type="button" onClick={() => setDeposit(String(expected))} className="mt-1 text-xs text-brand hover:underline">
              {t("requests.expectedDeposit")}: {expected.toLocaleString()} EGP · {t("requests.useEstimate")}
            </button>
          )}
        </div>
      )}

      <div><label className="label">{t("requests.notes")}</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

      {isSpecial && allowsPhotos(type) && (
        <div><label className="label">{t("requests.photos")}</label><PhotoUpload photos={photos} onChange={setPhotos} /></div>
      )}

      <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : t("requests.create")}</button>
    </div>
  );
}
