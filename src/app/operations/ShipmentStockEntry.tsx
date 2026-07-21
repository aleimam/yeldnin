"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { uploadImage } from "@/lib/chat/upload-image";
import { setShipmentItemsExpiryAction, addShipmentPhotoAction, removeShipmentPhotoAction } from "./actions";

export type EntryItem = {
  id: number; uid: string | null; productId: number; productName: string;
  /** Workflow label resolved server-side (the workflow config isn't client-side). */
  statusLabel: string;
  expiryDate: string | null; lotCode: string | null;
};
export type EntryPhoto = { id: number; assetId: string };

const fmt = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

/**
 * Ops stock-in entry for an incoming shipment.
 *
 * Expiry/lot are PER UNIT, but the common case is "every unit of this product
 * shares one expiry" — so this is select-then-apply rather than a form per unit:
 * tick a whole product group (or the odd unit that differs), type the value
 * once, apply. That keeps a 200-unit shipment to a few clicks while still
 * allowing every unit to differ.
 */
export function ShipmentStockEntry({
  shipmentId, items, photos, canManage,
}: {
  shipmentId: number;
  items: EntryItem[];
  photos: EntryPhoto[];
  canManage: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [expiry, setExpiry] = useState("");
  const [lot, setLot] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busyPhoto, setBusyPhoto] = useState(false);

  // Group by product so "all units of this product" is one click — the shape
  // Ops actually work in.
  const groups = useMemo(() => {
    const m = new Map<number, EntryItem[]>();
    for (const it of items) (m.get(it.productId) ?? m.set(it.productId, []).get(it.productId)!).push(it);
    return [...m.entries()];
  }, [items]);

  const toggle = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleMany = (ids: number[]) => setSel((s) => {
    const n = new Set(s);
    const allOn = ids.every((i) => n.has(i));
    for (const i of ids) { if (allOn) n.delete(i); else n.add(i); }
    return n;
  });

  const apply = () => start(async () => {
    setMsg(null);
    try {
      const r = await setShipmentItemsExpiryAction({ shipmentId, itemIds: [...sel], expiry: expiry || null, lotCode: lot || null });
      setMsg(t("shipments.entryApplied").replace("{n}", String(r.updated)));
      setSel(new Set());
      router.refresh();
    } catch {
      setMsg(t("shipments.entryFailed"));
    }
  });

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusyPhoto(true);
    setMsg(null);
    try {
      for (const f of Array.from(files)) {
        const up = await uploadImage(f);
        if (up) await addShipmentPhotoAction(shipmentId, up.assetId);
      }
      router.refresh();
    } finally {
      setBusyPhoto(false);
    }
  };

  const missing = items.filter((i) => !i.expiryDate).length;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="mb-1 font-semibold text-ink">{t("shipments.stockEntry")}</h2>
        <p className="mb-3 text-sm text-muted">{t("shipments.stockEntryHint")}</p>
        {missing > 0 && (
          <p className="mb-3 text-sm text-amber-700">{t("shipments.missingExpiry").replace("{n}", String(missing))}</p>
        )}

        {canManage && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted">{t("shipments.expiry")}</span>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="input" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">{t("shipments.lotCode")}</span>
              <input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="—" className="input" />
            </label>
            <button onClick={apply} disabled={pending || sel.size === 0} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">
              {pending ? "…" : t("shipments.applyToSelected").replace("{n}", String(sel.size))}
            </button>
            {msg && <span className="text-sm text-muted">{msg}</span>}
          </div>
        )}

        <table className="w-full text-sm" data-cards>
          <thead>
            <tr className="border-b border-line">
              <th className="th w-8" />
              <th className="th">{t("requests.product")}</th>
              <th className="th">{t("shipments.unit")}</th>
              <th className="th">{t("requests.status")}</th>
              <th className="th">{t("shipments.expiry")}</th>
              <th className="th">{t("shipments.lotCode")}</th>
            </tr>
          </thead>
          {groups.map(([productId, rows]) => (
            <tbody key={productId} className="divide-y divide-line border-b border-line">
              <tr className="bg-surface/50">
                <td className="td">
                  {canManage && (
                    <input
                      type="checkbox"
                      aria-label={rows[0].productName}
                      checked={rows.every((r) => sel.has(r.id))}
                      onChange={() => toggleMany(rows.map((r) => r.id))}
                    />
                  )}
                </td>
                <td className="td font-medium text-ink" colSpan={5}>{rows[0].productName} <span className="text-muted">({rows.length})</span></td>
              </tr>
              {rows.map((it) => (
                <tr key={it.id}>
                  <td className="td">
                    {canManage && <input type="checkbox" aria-label={it.uid ?? `#${it.id}`} checked={sel.has(it.id)} onChange={() => toggle(it.id)} />}
                  </td>
                  <td className="td" data-label={t("requests.product")} />
                  <td className="td" data-label={t("shipments.unit")}>{it.uid ?? `#${it.id}`}</td>
                  <td className="td" data-label={t("requests.status")}>{it.statusLabel}</td>
                  <td className="td" data-label={t("shipments.expiry")}>{fmt(it.expiryDate)}</td>
                  <td className="td" data-label={t("shipments.lotCode")}>{it.lotCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 font-semibold text-ink">{t("shipments.photos")}</h2>
        <p className="mb-3 text-sm text-muted">{t("shipments.photosHint")}</p>
        {canManage && (
          <input type="file" accept="image/*" multiple disabled={busyPhoto} onChange={(e) => onPick(e.target.files)} className="mb-3 text-sm" />
        )}
        {photos.length === 0 ? (
          <p className="text-sm text-muted">{t("shipments.noPhotos")}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {photos.map((p) => (
              <figure key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/asset/${p.assetId}`} alt="" className="h-28 w-28 rounded object-cover" />
                {canManage && (
                  <button
                    onClick={() => start(async () => { await removeShipmentPhotoAction(shipmentId, p.id); router.refresh(); })}
                    className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white"
                    aria-label={t("common.delete")}
                  >
                    ×
                  </button>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
