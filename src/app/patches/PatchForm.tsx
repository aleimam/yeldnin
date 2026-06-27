"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { HandlingFeeInput } from "@/components/HandlingFeeInput";
import { AutoTextarea } from "@/components/AutoTextarea";
import { FX_BASE } from "@/lib/fx/fx-logic";
import { createPatchAction } from "./actions";

export interface PatchPurchaseOption {
  id: number;
  label: string;
  items: { id: number; productName: string }[];
}

export function PatchForm({ purchases, couriers, initialPurchaseId }: { purchases: PatchPurchaseOption[]; couriers: { id: number; name: string }[]; initialPurchaseId?: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initialPid =
    initialPurchaseId && purchases.some((p) => String(p.id) === initialPurchaseId)
      ? initialPurchaseId
      : purchases[0]
        ? String(purchases[0].id)
        : "";
  const [purchaseId, setPurchaseId] = useState<string>(initialPid);
  const selected = purchases.find((p) => String(p.id) === purchaseId);
  const [itemIds, setItemIds] = useState<number[]>(selected ? selected.items.map((i) => i.id) : []);
  const [tracking, setTracking] = useState("");
  const [courierId, setCourierId] = useState("");
  const [notes, setNotes] = useState("");
  const [handlingFee, setHandlingFee] = useState("");
  const [handlingFeeCurrency, setHandlingFeeCurrency] = useState(FX_BASE);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  function changePurchase(id: string) {
    setPurchaseId(id);
    const p = purchases.find((x) => String(x.id) === id);
    setItemIds(p ? p.items.map((i) => i.id) : []);
  }
  const toggle = (id: number) => setItemIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function submit() {
    setError(null);
    start(async () => {
      const res = await createPatchAction({
        purchaseId: Number(purchaseId),
        itemIds,
        tracking: tracking || undefined,
        courierId: courierId ? Number(courierId) : null,
        notes: notes || undefined,
        handlingFee: handlingFee ? Number(handlingFee) : null,
        handlingFeeCurrency: handlingFee ? handlingFeeCurrency : null,
        photoIds: photos.map((p) => p.id),
      });
      if (res.ok) router.push(`/patches/${res.id}`);
      else setError(res.error);
    });
  }

  if (!purchases.length) {
    return <div className="card p-6 text-sm text-muted">{t("patches.noneToDispatch")}</div>;
  }

  return (
    <div className="card max-w-2xl space-y-4 p-6">
      {error && <div className="alert alert-error">{error}</div>}

      <div>
        <label className="label">{t("patches.fromPurchase")}</label>
        <select className="input" value={purchaseId} onChange={(e) => changePurchase(e.target.value)}>
          {purchases.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      {selected && (
        <div>
          <label className="label">{t("patches.items")}</label>
          <div className="space-y-1 rounded-lg border border-line p-3">
            {selected.items.map((it) => (
              <label key={it.id} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={itemIds.includes(it.id)} onChange={() => toggle(it.id)} />
                {it.productName} <span className="text-xs text-muted">#{it.id}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">{t("patches.tracking")}</label><input className="input" value={tracking} onChange={(e) => setTracking(e.target.value)} /></div>
        <div>
          <label className="label">{t("patches.courier")}</label>
          <select className="input" value={courierId} onChange={(e) => setCourierId(e.target.value)}>
            <option value="">{t("pricer.f.choose")}</option>
            {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="sm:max-w-xs">
        <HandlingFeeInput fee={handlingFee} currency={handlingFeeCurrency} onFee={setHandlingFee} onCurrency={setHandlingFeeCurrency} />
      </div>
      <div><label className="label">{t("patches.notes")}</label><AutoTextarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div><label className="label">{t("patches.photos")}</label><PhotoUpload photos={photos} onChange={setPhotos} /></div>

      <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : t("patches.create")}</button>
    </div>
  );
}
