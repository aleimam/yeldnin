"use client";
import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { SHAPES, PACKAGING, SIZES } from "@/lib/pricing/pricing-logic";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { Toggle } from "@/components/Toggle";
import { calcSupplementAction } from "./actions";

type Errors = Record<string, string>;
export interface SupplierOption {
  id: number;
  name: string;
  availableUSA: boolean;
  availableUK: boolean;
  availableEU: boolean;
}

const COUNTRIES = ["USA", "UK", "EU"] as const;

/** Available suppliers for a country. */
export function suppliersFor(suppliers: SupplierOption[], country: string) {
  return suppliers.filter((s) =>
    country === "USA" ? s.availableUSA : country === "UK" ? s.availableUK : s.availableEU,
  );
}
/** Default to a supplier named "Amazon" if present for the country. */
export function amazonIdFor(suppliers: SupplierOption[], country: string): string {
  const a = suppliersFor(suppliers, country).find((s) => s.name.trim().toLowerCase() === "amazon");
  return a ? String(a.id) : "";
}

export function SupplementCalculator({ suppliers }: { suppliers: SupplierOption[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [price, setPrice] = useState<number | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [f, setF] = useState({
    productName: "",
    importedFrom: "USA",
    supplierId: amazonIdFor(suppliers, "USA"),
    purchasePrice: "",
    count: "",
    dailyDose: "",
    weight: "",
    shape: "Capsules/Tablets",
    packaging: "Plastic",
    size: "Normal",
    maleSupport: false,
    notes: "",
  });
  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const availSuppliers = suppliersFor(suppliers, f.importedFrom);
  const err = (k: string) => (errors[k] ? "input input-error" : "input");

  function changeCountry(c: string) {
    setF((prev) => ({ ...prev, importedFrom: c, supplierId: amazonIdFor(suppliers, c) }));
  }

  function submit() {
    start(async () => {
      const res = await calcSupplementAction({
        values: f,
        productName: f.productName || undefined,
        supplierId: f.supplierId ? Number(f.supplierId) : null,
        notes: f.notes || undefined,
        photoIds: photos.map((p) => p.id),
      });
      if (res.ok) {
        setErrors({});
        setPrice(res.price);
      } else {
        setErrors(res.fieldErrors);
        setPrice(null);
      }
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="card space-y-4 p-6">
        {/* Row 1: Product name (2x) + Imported from */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("pricer.f.productName")} className="sm:col-span-2">
            <input className="input" value={f.productName} onChange={(e) => set("productName", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.importedFrom")} error={errors.importedFrom}>
            <select className={err("importedFrom")} value={f.importedFrom} onChange={(e) => changeCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        {/* Row 2: Supplier, Price, Weight */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("pricer.f.supplier")}>
            <select className="input" value={f.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
              <option value="">{t("pricer.f.choose")}</option>
              {availSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={t("pricer.f.purchasePrice")} error={errors.purchasePrice}>
            <input type="number" step="any" className={err("purchasePrice")} value={f.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.weight")} error={errors.weight}>
            <input type="number" step="any" className={err("weight")} value={f.weight} onChange={(e) => set("weight", e.target.value)} />
          </Field>
        </div>

        {/* Row 3: Count, Daily dose, Shape */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("pricer.f.count")} error={errors.count}>
            <input type="number" step="any" className={err("count")} value={f.count} onChange={(e) => set("count", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.dailyDose")} error={errors.dailyDose}>
            <input type="number" step="any" className={err("dailyDose")} value={f.dailyDose} onChange={(e) => set("dailyDose", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.shape")} error={errors.shape}>
            <select className={err("shape")} value={f.shape} onChange={(e) => set("shape", e.target.value)}>
              {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        {/* Row 4: Packaging, Size, Male support */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("pricer.f.packaging")} error={errors.packaging}>
            <select className={err("packaging")} value={f.packaging} onChange={(e) => set("packaging", e.target.value)}>
              {PACKAGING.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label={t("pricer.f.size")} error={errors.size}>
            <select className={err("size")} value={f.size} onChange={(e) => set("size", e.target.value)}>
              {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="flex items-center self-end pb-2">
            <Toggle checked={f.maleSupport} onChange={(v) => set("maleSupport", v)} label={t("pricer.f.maleSupport")} />
          </div>
        </div>

        {/* Notes + Photos side by side on desktop */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("pricer.f.notes")}>
            <textarea className="input" rows={4} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.photos")}>
            <PhotoUpload photos={photos} onChange={setPhotos} />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "…" : t("pricer.calculate")}
        </button>
        {Object.keys(errors).length > 0 && <p className="text-sm text-red-600">{t("pricer.fixErrors")}</p>}
        {price !== null && (
          <div className="text-lg text-ink">
            {t("pricer.sellingPrice")}:{" "}
            <span className="text-2xl font-bold text-brand">{price.toLocaleString()} EGP</span>
          </div>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
