"use client";
import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { Toggle } from "@/components/Toggle";
import { calcDeviceAction } from "./actions";
import { suppliersFor, amazonIdFor, type SupplierOption } from "./SupplementCalculator";

const COUNTRIES = ["USA", "UK", "EU"] as const;

export function DeviceCalculator({ suppliers }: { suppliers: SupplierOption[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<number | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [f, setF] = useState({
    productName: "",
    importedFrom: "USA",
    supplierId: amazonIdFor(suppliers, "USA"),
    purchasePrice: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
    weightKg: "",
    maleSupport: false,
    notes: "",
  });
  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((prev) => ({ ...prev, [k]: v }));
  const err = (k: string) => (errors[k] ? "input input-error" : "input");

  const availSuppliers = suppliersFor(suppliers, f.importedFrom);

  function changeCountry(c: string) {
    setF((prev) => ({ ...prev, importedFrom: c, supplierId: amazonIdFor(suppliers, c) }));
  }

  function submit() {
    start(async () => {
      const res = await calcDeviceAction({
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
      {/* Calculated price — shown at the top on mobile */}
      {price !== null && (
        <div className="card mb-4 flex items-center justify-between p-4 sm:hidden">
          <span className="text-sm text-muted">{t("pricer.sellingPrice")}</span>
          <span className="text-2xl font-bold text-brand">{price.toLocaleString()} EGP</span>
        </div>
      )}

      <div className="card space-y-4 p-6">
        {/* Identity & sourcing: 2-up on mobile (Imported|Supplier, Price|Weight),
            3-up on desktop. Product name spans full width. */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label={t("pricer.f.productName")} className="col-span-2">
            <input className="input" value={f.productName} onChange={(e) => set("productName", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.importedFrom")} error={errors.importedFrom}>
            <select className={err("importedFrom")} value={f.importedFrom} onChange={(e) => changeCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t("pricer.f.supplier")}>
            <select className="input" value={f.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
              <option value="">{t("pricer.f.choose")}</option>
              {availSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={t("pricer.f.purchasePrice")} error={errors.purchasePrice}>
            <input type="number" step="any" className={err("purchasePrice")} value={f.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.weightKg")} error={errors.weightKg}>
            <input type="number" step="any" className={err("weightKg")} value={f.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
          </Field>
        </div>

        {/* Dimensions: always 3 across (one row) on mobile and desktop */}
        <div className="grid grid-cols-3 gap-4">
          <Field label={t("pricer.f.length")} error={errors.lengthCm}>
            <input type="number" step="any" className={err("lengthCm")} value={f.lengthCm} onChange={(e) => set("lengthCm", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.width")} error={errors.widthCm}>
            <input type="number" step="any" className={err("widthCm")} value={f.widthCm} onChange={(e) => set("widthCm", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.height")} error={errors.heightCm}>
            <input type="number" step="any" className={err("heightCm")} value={f.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
          </Field>
        </div>

        <Toggle checked={f.maleSupport} onChange={(v) => set("maleSupport", v)} label={t("pricer.f.maleSupport")} />


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
        <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
          {pending ? "…" : t("pricer.calculate")}
        </button>
        {Object.keys(errors).length > 0 && <p className="text-sm text-red-600">{t("pricer.fixErrors")}</p>}
        {price !== null && (
          <div className="hidden text-lg text-ink sm:block">
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
