"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { useUnsavedGuard } from "@/components/useUnsavedGuard";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { AutoTextarea } from "@/components/AutoTextarea";
import { Combobox } from "@/components/Combobox";
import { REQUEST_TYPES, requiresCustomer, allowsPhotos, expectedDeposit } from "@/lib/requests/request-logic";
import type { Scope } from "@/lib/products/products-logic";
import { createRequestAction, updateRequestAction } from "./actions";

interface Line {
  productId: string;
  count: string;
  sellingPrice: string;
  purchasePrice: string;
  purchaseCurrency: string;
  notes: string;
}
const blankLine = (): Line => ({ productId: "", count: "1", sellingPrice: "", purchasePrice: "", purchaseCurrency: "", notes: "" });

export interface RequestFormInitial {
  type: string;
  scope: string;
  customerId: string;
  notes: string;
  deposit: string;
  lines: Line[];
  photos: UploadedPhoto[];
}

export function RequestForm({
  allowedScopes,
  products,
  customers,
  depositPct,
  canSeePurchase,
  editId,
  initial,
}: {
  allowedScopes: Scope[];
  products: { id: number; name: string; sku: string | null; scope: string; type: string; sellingPrice: number | null; purchasePrice: number | null }[];
  customers: { id: number; name: string; scope: string }[];
  depositPct: number;
  /** Buy price is hidden from EGV Sales (golden rule); shown to XOONX/purchasing/admin. */
  canSeePurchase: boolean;
  editId?: number;
  initial?: RequestFormInitial;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState(initial?.type ?? "RESTOCK");
  const [scope, setScope] = useState<string>(initial?.scope ?? allowedScopes[0] ?? "EGV");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [newMode, setNewMode] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", contactNumber: "" });
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [deposit, setDeposit] = useState(initial?.deposit ?? "");
  const [lines, setLines] = useState<Line[]>(initial?.lines?.length ? initial.lines : [blankLine()]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initial?.photos ?? []);

  // Warn before navigating away once any real data has been entered.
  const dirty =
    !!customerId || !!notes.trim() || !!deposit || !!newCust.name || !!newCust.contactNumber || photos.length > 0 ||
    lines.some((l) => l.productId || l.sellingPrice || l.purchasePrice || l.notes || l.purchaseCurrency || l.count !== "1");
  useUnsavedGuard(dirty, t("common.unsaved"));

  const isSpecial = requiresCustomer(type);
  const expected = expectedDeposit(
    depositPct,
    lines.map((l) => ({ count: Number(l.count) || 0, sellingPrice: l.sellingPrice ? Number(l.sellingPrice) : null })),
  );
  // XOONX requests may only contain XOONX-type products (enforced server-side too).
  const scopeProducts = products.filter((p) => p.scope === scope && (scope !== "XOONX" || p.type === "XOONX"));
  const scopeCustomers = customers.filter((c) => c.scope === scope);
  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  // Selecting a product copies its default selling price into the line (and buy
  // price too, but only for users allowed to see it — Sales never does).
  const pickProduct = (i: number, productId: string) => {
    const p = scopeProducts.find((sp) => String(sp.id) === productId);
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i
          ? {
              ...l,
              productId,
              sellingPrice: p?.sellingPrice != null ? String(p.sellingPrice) : l.sellingPrice,
              purchasePrice: canSeePurchase && p?.purchasePrice != null ? String(p.purchasePrice) : l.purchasePrice,
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
          purchasePrice: canSeePurchase && l.purchasePrice ? Number(l.purchasePrice) : null,
          purchaseCurrency: l.purchaseCurrency || null,
          notes: l.notes || undefined,
        })),
      photoIds: isSpecial && allowsPhotos(type) ? photos.map((p) => p.id) : [],
    };
    start(async () => {
      const res = editId ? await updateRequestAction(editId, payload) : await createRequestAction(payload);
      if (res.ok) router.push(`/requests/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <div className="card max-w-3xl space-y-4 p-6">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">{t("requests.type")}</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {REQUEST_TYPES.map((ty) => <option key={ty} value={ty}>{t(`reqtype.${ty}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t("requests.scope")}</label>
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value)} disabled={!!editId}>
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
              <Combobox
                className="col-span-2 sm:col-span-4"
                placeholder={`${t("requests.product")}…`}
                value={l.productId}
                onChange={(v) => pickProduct(i, v)}
                options={scopeProducts.map((p) => ({ value: String(p.id), label: p.name, hint: p.sku ?? undefined }))}
              />
              <input type="number" min={1} className="input sm:col-span-2" placeholder={t("requests.count")} value={l.count} onChange={(e) => setLine(i, "count", e.target.value)} />
              <input type="number" step="any" className="input sm:col-span-2" placeholder={t("requests.sell")} value={l.sellingPrice} onChange={(e) => setLine(i, "sellingPrice", e.target.value)} />
              {canSeePurchase && <input type="number" step="any" className="input sm:col-span-2" placeholder={t("requests.buy")} value={l.purchasePrice} onChange={(e) => setLine(i, "purchasePrice", e.target.value)} />}
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

      <div><label className="label">{t("requests.notes")}</label><AutoTextarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

      {isSpecial && allowsPhotos(type) && (
        <div><label className="label">{t("requests.photos")}</label><PhotoUpload photos={photos} onChange={setPhotos} /></div>
      )}

      <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : editId ? t("req.save") : t("requests.create")}</button>
    </div>
  );
}
