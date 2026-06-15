"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { createTransactionAction, updateTransactionAction } from "./actions";

export function ExpenseForm({
  categories,
  txId,
  initial,
}: {
  categories: { id: number; name: string }[];
  txId?: number;
  initial?: { categoryId?: number; amount?: string; note?: string };
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [categoryId, setCategoryId] = useState(String(initial?.categoryId ?? categories[0]?.id ?? ""));
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  function submit() {
    setError(null);
    setSaved(false);
    const payload = {
      amount: parseFloat(amount),
      categoryId: Number(categoryId),
      note: note || undefined,
      attachmentIds: photos.map((p) => p.id),
    };
    start(async () => {
      const res = txId
        ? await updateTransactionAction(txId, payload)
        : await createTransactionAction(payload);
      if (res.ok) {
        setSaved(true);
        setPhotos([]);
        if (!txId) {
          setAmount("");
          setNote("");
        }
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
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{t("exp.amount")}</label>
        <input type="number" step="any" min="0" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
