"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { changeDeliveryStatusAction } from "../actions";
import {
  FAILURE_REASONS,
  DELIVERY_SLOTS,
  isBouncing,
  requiresFailureReason,
  canTransition,
  DELIVERY_STATUSES,
  egpToPiastres,
} from "@/lib/deliveries/deliveries-logic";

export function StatusForm({
  id,
  status,
  couriers,
  courierId,
  collectEgp,
}: {
  id: number;
  status: string;
  couriers: { id: number; name: string }[];
  courierId: number | null;
  collectEgp: number;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [courier, setCourier] = useState(courierId ? String(courierId) : "");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [collected, setCollected] = useState(String(collectEgp));
  const [note, setNote] = useState("");

  // Only offer moves that are actually legal from here — an unreachable option
  // in a dropdown is a bug report waiting to happen.
  const next = DELIVERY_STATUSES.filter((s) => canTransition(status, s));
  if (!next.length) return <p className="text-sm text-muted">{t("dlv.closed")}</p>;

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await changeDeliveryStatusAction(id, {
        to,
        courierId: to === "ASSIGNED" ? Number(courier) || null : undefined,
        failureReason: requiresFailureReason(to) ? reason : null,
        promisedDate: isBouncing(to) ? date : null,
        promisedSlot: isBouncing(to) ? slot : null,
        collectedPiastres: to === "DELIVERED" ? egpToPiastres(Number(collected)) : null,
        note: note.trim() || null,
      });
      if (!r.ok) setError(r.error);
      else {
        setTo("");
        router.refresh();
      }
    });
  };

  return (
    <div className="card space-y-3 p-4">
      <label className="label">{t("dlv.changeStatus")}</label>
      <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="">—</option>
        {next.map((s) => (
          <option key={s} value={s}>
            {t(`dlv.status.${s}`)}
          </option>
        ))}
      </select>

      {to === "ASSIGNED" && (
        <div>
          <label className="label">{t("dlv.courier")}</label>
          <select className="input" value={courier} onChange={(e) => setCourier(e.target.value)}>
            <option value="">—</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {requiresFailureReason(to) && (
        <div>
          <label className="label">{t("dlv.failureReason")}</label>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">—</option>
            {FAILURE_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`dlv.reason.${r}`)}
              </option>
            ))}
          </select>
        </div>
      )}

      {isBouncing(to) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t("dlv.newDate")}</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("dlv.newSlot")}</label>
            <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="">—</option>
              {DELIVERY_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {to === "DELIVERED" && collectEgp > 0 && (
        <div>
          <label className="label">{t("dlv.collectedEgp")}</label>
          <input type="number" step="0.01" className="input" value={collected} onChange={(e) => setCollected(e.target.value)} />
          {Number(collected) !== collectEgp && (
            // Not a blocker: the courier records what actually happened, and the
            // flag sends a human to fix the ORDER. The sync never edits it.
            <p className="mt-1 text-xs text-amber-700">{t("dlv.mismatchWarn")}</p>
          )}
        </div>
      )}

      {to && (
        <div>
          <label className="label">{t("dlv.note")}</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={!to || pending} onClick={submit}>
        {pending ? "…" : t("dlv.save")}
      </button>
    </div>
  );
}
