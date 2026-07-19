"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { Toggle } from "@/components/Toggle";
import { AutoTextarea } from "@/components/AutoTextarea";
import { PRODUCT_TYPES, type Scope } from "@/lib/products/products-logic";
import { createProductAction, saveProductAction, archiveProductAction } from "./actions";

export interface SupplierOpt {
  id: number;
  label: string;
  regions: string[]; // USA | UK | EU availability
}
export interface ProductInitial {
  id?: number;
  name: string;
  sku: string;
  scope: string;
  type: string;
  originRegion: string; // "" | USA | UK | EU
  defaultSupplierId: string; // "" or number-as-string
  weightG: string;
  purchasePrice: string;
  sellingPrice: string;
  size: string;
  grade: string;
  url: string;
  notes: string;
  isMaleSupport: boolean;
  active: boolean;
  photos: UploadedPhoto[];
}

export function ProductForm({
  mode,
  initial,
  allowedScopes,
  suppliers,
  canSeePurchase,
}: {
  mode: "create" | "edit";
  initial: ProductInitial;
  allowedScopes: Scope[];
  suppliers: SupplierOpt[];
  /** Purchase (buy) price is Purchasing/Logistics-only; hidden for Sales/XOONX. */
  canSeePurchase: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState(initial.active);
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initial.photos);
  const originalIds = new Set(initial.photos.map((p) => p.id));
  const [f, setF] = useState({
    name: initial.name,
    sku: initial.sku,
    scope: initial.scope || allowedScopes[0] || "",
    type: initial.type,
    originRegion: initial.originRegion,
    defaultSupplierId: initial.defaultSupplierId,
    weightG: initial.weightG,
    purchasePrice: initial.purchasePrice,
    sellingPrice: initial.sellingPrice,
    size: initial.size,
    grade: initial.grade,
    url: initial.url,
    notes: initial.notes,
    isMaleSupport: initial.isMaleSupport,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  // VEEEY-scope products are mastered by the Veeey storefront: the catalog-display
  // fields are read-only here (the sync is their sole writer); only the
  // supply-chain layer + the heavy toggle stay editable.
  const veeeyManaged = mode === "edit" && f.scope === "VEEEY";
  const typeIsSupplement = f.type === "SUPPLEMENT" || f.type === "HEAVY_SUPPLEMENT";
  const typeOptions = veeeyManaged ? (typeIsSupplement ? ["SUPPLEMENT", "HEAVY_SUPPLEMENT"] : [f.type]) : (PRODUCT_TYPES as readonly string[]);
  // Default Supplier choices are gated by the product's origin region. Changing
  // the origin clears a supplier that no longer serves it.
  const availableSuppliers = f.originRegion ? suppliers.filter((s) => s.regions.includes(f.originRegion)) : suppliers;
  const setOrigin = (v: string) =>
    setF((p) => {
      const sel = suppliers.find((s) => String(s.id) === p.defaultSupplierId);
      const keep = !v || !sel || sel.regions.includes(v);
      return { ...p, originRegion: v, defaultSupplierId: keep ? p.defaultSupplierId : "" };
    });

  function submit() {
    setError(null);
    setSaved(false);
    const payload = {
      name: f.name,
      sku: f.sku || undefined,
      scope: f.scope,
      type: f.type,
      originRegion: f.originRegion || null,
      defaultSupplierId: f.defaultSupplierId ? Number(f.defaultSupplierId) : null,
      weightG: f.weightG ? Number(f.weightG) : null,
      purchasePrice: f.purchasePrice ? Number(f.purchasePrice) : null,
      sellingPrice: f.sellingPrice ? Number(f.sellingPrice) : null,
      size: f.size || undefined,
      grade: f.grade || undefined,
      url: f.url || undefined,
      notes: f.notes || undefined,
      isMaleSupport: f.isMaleSupport,
      photoIds: photos.map((p) => p.id).filter((id) => !originalIds.has(id)),
    };
    start(async () => {
      const res =
        mode === "create"
          ? await createProductAction(payload)
          : await saveProductAction({ ...payload, id: initial.id!, active });
      if (res.ok) {
        if (mode === "create") router.push(`/products/${res.id}`);
        else {
          setSaved(true);
          router.refresh();
        }
      } else setError(res.error);
    });
  }

  function archive() {
    if (!confirm(t("products.archiveConfirm"))) return;
    start(async () => {
      await archiveProductAction(initial.id!);
      router.push("/products");
    });
  }

  return (
    <div className="card max-w-3xl space-y-4 p-6">
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{t("products.saved")}</div>}
      {veeeyManaged && <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{t("products.veeeyManaged")}</div>}

      {/* Desktop: Name (3fr) + SKU (1fr) on the first row. */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t("products.name")} className="sm:col-span-3"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} disabled={veeeyManaged} /></Field>
        <Field label={t("products.sku")}><input className="input" value={f.sku} onChange={(e) => set("sku", e.target.value)} disabled={veeeyManaged} /></Field>
      </div>

      {/* Desktop: the remaining fields three per row. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("products.scope")}>
          <select className="input" value={f.scope} onChange={(e) => set("scope", e.target.value)} disabled={veeeyManaged || mode === "edit"}>
            {allowedScopes.map((s) => <option key={s} value={s}>{t(`scope.${s}`)}</option>)}
          </select>
        </Field>
        <Field label={t("products.type")}>
          <select className="input" value={f.type} onChange={(e) => set("type", e.target.value)} disabled={veeeyManaged && !typeIsSupplement}>
            {typeOptions.map((ty) => <option key={ty} value={ty}>{t(`ptype.${ty}`)}</option>)}
          </select>
        </Field>
        <Field label={t("products.origin")}>
          <select className="input" value={f.originRegion} onChange={(e) => setOrigin(e.target.value)}>
            <option value="">{t("products.originAny")}</option>
            {["USA", "UK", "EU"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label={t("products.supplier")}>
          <select className="input" value={f.defaultSupplierId} onChange={(e) => set("defaultSupplierId", e.target.value)}>
            <option value="">{t("pricer.f.choose")}</option>
            {availableSuppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label={t("products.weight")}><input type="number" step="any" className="input" value={f.weightG} onChange={(e) => set("weightG", e.target.value)} /></Field>
        {canSeePurchase && <Field label={t("products.purchasePrice")}><input type="number" step="any" className="input" value={f.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} /></Field>}
        <Field label={t("products.sellingPrice")}><input type="number" step="any" className="input" value={f.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} /></Field>
        <Field label={t("products.size")}><input className="input" value={f.size} onChange={(e) => set("size", e.target.value)} /></Field>
        <Field label={t("products.grade")}><input className="input" value={f.grade} onChange={(e) => set("grade", e.target.value)} /></Field>
        <Field label={t("products.url")} className="sm:col-span-3"><input className="input" value={f.url} onChange={(e) => set("url", e.target.value)} /></Field>
      </div>

      <Field label={t("products.notes")}>
        <AutoTextarea value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <div className="flex items-center gap-6">
        <Toggle checked={f.isMaleSupport} onChange={(v) => set("isMaleSupport", v)} label={t("products.maleSupport")} />
        {mode === "edit" && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t("products.active")}
          </label>
        )}
      </div>

      <Field label={t("products.photos")}>
        {veeeyManaged ? (
          <div className="flex flex-wrap gap-2">
            {photos.length === 0 && <span className="text-sm text-muted">—</span>}
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
            ))}
          </div>
        ) : (
          <PhotoUpload photos={photos} onChange={setPhotos} />
        )}
      </Field>

      <div className="flex items-center gap-4">
        <button onClick={submit} disabled={pending} className="btn-primary">
          {pending ? "…" : mode === "create" ? t("products.create") : t("common.save")}
        </button>
        {mode === "edit" && (
          <button onClick={archive} disabled={pending} className="text-sm text-red-600 hover:underline disabled:opacity-50">
            {t("products.archive")}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
