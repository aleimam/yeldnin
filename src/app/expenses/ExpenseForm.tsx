"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { DateField } from "@/components/DateField";
import { categoryLabel } from "@/lib/expenses/category-label";
import { CATEGORY_TYPES, typeLabelKey } from "@/lib/expenses/expenses-logic";
import { createTransactionAction, updateTransactionAction } from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseForm({
  categories,
  txId,
  initial,
}: {
  categories: { id: number; name: string; nameAr?: string | null; type: string }[];
  txId?: number;
  initial?: { categoryId?: number; amount?: string; note?: string; accruingDate?: string };
}) {
  const t = useT();
  const locale = useLocale();
  const arByName = Object.fromEntries(categories.filter((c) => c.nameAr).map((c) => [c.name, c.nameAr as string]));
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [categoryId, setCategoryId] = useState(String(initial?.categoryId ?? categories[0]?.id ?? ""));
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [accruingDate, setAccruingDate] = useState(initial?.accruingDate ?? today());
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  function submit() {
    setError(null);
    setSaved(false);
    const payload = {
      amount: parseFloat(amount),
      categoryId: Number(categoryId),
      note: note || undefined,
      accruingDate,
      attachmentIds: photos.map((p) => p.id),
    };
    start(async () => {
      const res = txId
        ? await updateTransactionAction(txId, payload)
        : await createTransactionAction(payload);
      if (res.ok) {
        setSaved(true);
        setPhotos([]);
        if (txId) {
          // Editing: return to the (read-only) details page.
          router.push(`/expenses/transactions/${txId}`);
          return;
        }
        setAmount("");
        setNote("");
        setAccruingDate(today());
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="card max-w-2xl space-y-4 p-6">
      <div>
        <label className="label">{t("exp.category")}</label>
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {CATEGORY_TYPES.map((ty) => {
            const inType = categories.filter((c) => c.type === ty);
            if (inType.length === 0) return null;
            return (
              <optgroup key={ty} label={t(typeLabelKey(ty))}>
                {inType.map((c) => (
                  <option key={c.id} value={c.id}>{categoryLabel(t, c.name, locale, arByName)}</option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>
      <div>
        <label className="label">{t("exp.amount")}</label>
        <input type="number" step="any" min="0" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="label">{t("exp.accruingDate")}</label>
        <DateField className="input" value={accruingDate} onChange={(e) => setAccruingDate(e.target.value)} />
        <p className="mt-1 text-xs text-muted">{t("exp.accruingHint")}</p>
      </div>
      <div>
        <label className="label">{t("exp.note")}</label>
        <textarea rows={3} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div>
        <label className="label">{t("exp.attachments")}</label>
        <PhotoUpload photos={photos} onChange={setPhotos} accept="image/*,application/pdf" allowPdf />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">{t("exp.saved")}</p>}
      <button onClick={submit} disabled={pending} className="btn-primary">
        {pending ? "…" : t("exp.save")}
      </button>
    </div>
  );
}
