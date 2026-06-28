"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { AutoTextarea } from "@/components/AutoTextarea";
import { createTransferAction, eligibleItemsAction } from "./actions";

interface Endpoint {
  type: "HUB" | "TRIP" | "TRAVELER";
  id: number;
  label: string;
  country: string | null;
}
interface Carrier {
  id: number;
  name: string;
}

export function TransferForm({ endpoints, carriers, initialFrom }: { endpoints: Endpoint[]; carriers: Carrier[]; initialFrom: string }) {
  const t = useT();
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom); // "TYPE:id"
  const [to, setTo] = useState("");
  const [items, setItems] = useState<{ id: number; label: string }[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [loadingItems, setLoadingItems] = useState(false);
  const [carrierId, setCarrierId] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Load eligible items whenever the source endpoint changes.
  useEffect(() => {
    setItems([]);
    setSel(new Set());
    if (!from) return;
    const [type, id] = from.split(":");
    let live = true;
    setLoadingItems(true);
    eligibleItemsAction(type, Number(id))
      .then((list) => { if (live) setItems(list); })
      .finally(() => { if (live) setLoadingItems(false); });
    return () => { live = false; };
  }, [from]);

  const toggle = (id: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = () => {
    setErr(null);
    const [fromType, fromId] = from.split(":");
    const [toType, toId] = to.split(":");
    const itemIds = [...sel];
    start(async () => {
      const res = await createTransferAction({
        fromType,
        fromId: Number(fromId),
        toType,
        toId: Number(toId),
        itemIds,
        carrierId: carrierId ? Number(carrierId) : null,
        tracking: tracking || null,
        notes: note || null,
        photoAssetIds: photos.map((p) => p.id),
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.push(`/transfers/${res.id}`);
    });
  };

  return (
    <div className="card space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">{t("transfers.from")}</span>
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">{t("transfers.pickFrom")}</option>
            {endpoints.map((ep) => (
              <option key={`f-${ep.type}:${ep.id}`} value={`${ep.type}:${ep.id}`}>{ep.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{t("transfers.to")}</span>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">{t("transfers.pickTo")}</option>
            {endpoints.map((ep) => (
              <option key={`t-${ep.type}:${ep.id}`} value={`${ep.type}:${ep.id}`}>{ep.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="label">{t("transfers.items")}</span>
        {loadingItems ? (
          <p className="text-sm text-muted">…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">{from ? t("transfers.noEligible") : t("transfers.pickFromFirst")}</p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
            {items.map((it) => (
              <label key={it.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} />
                <span className="text-ink">{it.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">{t("transfers.carrier")}</span>
          <select className="input" value={carrierId} onChange={(e) => setCarrierId(e.target.value)}>
            <option value="">—</option>
            {carriers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{t("transfers.tracking")}</span>
          <input className="input" value={tracking} onChange={(e) => setTracking(e.target.value)} />
        </label>
      </div>

      <label className="block">
        <span className="label">{t("transfers.notes")}</span>
        <AutoTextarea value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div>
        <span className="label">{t("transfers.photos")}</span>
        <PhotoUpload photos={photos} onChange={setPhotos} />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="button" className="btn-primary" disabled={pending || !from || !to || sel.size === 0} onClick={submit}>
        {t("transfers.create")}
      </button>
    </div>
  );
}
