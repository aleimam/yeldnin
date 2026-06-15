"use client";
import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { SHAPES, PACKAGING, SIZES } from "@/lib/pricing/pricing-logic";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
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

export function SupplementCalculator({ suppliers }: { suppliers: SupplierOption[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [price, setPrice] = useState<number | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [f, setF] = useState({
    productName: "",
    importedFrom: "USA",
    supplierId: "",
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

  const availSuppliers = suppliers.filter((s) =>
    f.importedFrom === "USA" ? s.availableUSA : f.importedFrom === "UK" ? s.availableUK : s.availableEU,
  );

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

  const err = (k: string) => (errors[k] ? "input input-error" : "input");

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card space-y-4 p-6 lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("pricer.f.productName")}>
            <input className="input" value={f.productName} onChange={(e) => set("productName", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.importedFrom")} error={errors.importedFrom}>
            <select className={err("importedFrom")} value={f.importedFrom} onChange={(e) => { set("importedFrom", e.target.value); set("supplierId", ""); }}>
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
          <Field label={t("pricer.f.count")} error={errors.count}>
            <input type="number" step="any" className={err("count")} value={f.count} onChange={(e) => set("count", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.dailyDose")} error={errors.dailyDose}>
            <input type="number" step="any" className={err("dailyDose")} value={f.dailyDose} onChange={(e) => set("dailyDose", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.weight")} error={errors.weight}>
            <input type="number" step="any" className={err("weight")} value={f.weight} onChange={(e) => set("weight", e.target.value)} />
          </Field>
          <Field label={t("pricer.f.shape")} error={errors.shape}>
            <select className={err("shape")} value={f.shape} onChange={(e) => set("shape", e.target.value)}>
              {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
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
          <label className="flex items-center gap-2 self-end text-sm text-ink">
            <input type="checkbox" checked={f.maleSupport} onChange={(e) => set("maleSupport", e.target.checked)} />
            {t("pricer.f.maleSupport")}
          </label>
        </div>
        <Field label={t("pricer.f.notes")}>
          <textarea className="input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <Field label={t("pricer.f.photos")}>
          <PhotoUpload photos={photos} onChange={setPhotos} />
        </Field>
      </div>

      <div className="space-y-4">
        <button onClick={submit} disabled={pending} className="btn-primary w-full">
          {pending ? "…" : t("pricer.calculate")}
        </button>
        {Object.keys(errors).length > 0 && (
          <p className="text-sm text-red-600">{t("pricer.fixErrors")}</p>
        )}
        {price !== null && (
          <div className="card p-6 text-center">
            <div className="text-sm text-muted">{t("pricer.sellingPrice")}</div>
            <div className="mt-1 text-4xl font-bold text-brand">
              {price.toLocaleString()} <span className="text-lg">EGP</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
