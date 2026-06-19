"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { clearLabelKey, type ResolutionAction } from "@/lib/exceptions/exception-logic";
import { clearExceptionAction, returnToPoolAction, moveExceptionAction, assignDelayedAction } from "./actions";

interface Picker {
  id: number;
  label: string;
}

export function ExceptionActions({
  itemId,
  pool,
  actions,
  hasRequest,
  issueId,
  trips,
  hubs,
}: {
  itemId: number;
  pool: string;
  actions: ResolutionAction[];
  hasRequest: boolean;
  issueId: number | null;
  trips: Picker[];
  hubs: Picker[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [moveTarget, setMoveTarget] = useState("");
  const [tripTarget, setTripTarget] = useState("");

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {actions.includes("move") && (
        <span className="flex items-center gap-1">
          <select className="input h-8 w-36 py-0 text-xs" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} disabled={pending}>
            <option value="">{t("exceptions.pickTarget")}</option>
            {hubs.map((h) => (
              <option key={`H${h.id}`} value={`HUB:${h.id}`}>🏠 {h.label}</option>
            ))}
            {trips.map((tr) => (
              <option key={`T${tr.id}`} value={`TRIP:${tr.id}`}>✈️ {tr.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary px-2 py-1 text-xs"
            disabled={pending || !moveTarget}
            onClick={() => {
              const [type, id] = moveTarget.split(":");
              run(() => moveExceptionAction([itemId], type as "TRIP" | "HUB", Number(id)));
            }}
          >
            {t("exceptions.action.move")}
          </button>
        </span>
      )}
      {actions.includes("assignTrip") && (
        <span className="flex items-center gap-1">
          <select className="input h-8 w-36 py-0 text-xs" value={tripTarget} onChange={(e) => setTripTarget(e.target.value)} disabled={pending}>
            <option value="">{t("exceptions.pickTrip")}</option>
            {trips.map((tr) => (
              <option key={tr.id} value={tr.id}>{tr.label}</option>
            ))}
          </select>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending || !tripTarget} onClick={() => run(() => assignDelayedAction([itemId], Number(tripTarget)))}>
            {t("exceptions.action.assignTrip")}
          </button>
        </span>
      )}
      {actions.includes("rebuy") && (
        <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending || !hasRequest} onClick={() => run(() => returnToPoolAction([itemId]))}>
          {t("exceptions.action.rebuy")}
        </button>
      )}
      {actions.includes("compensate") && issueId && (
        <Link href={`/issues/${issueId}`} className="btn-secondary px-2 py-1 text-xs">
          {t("exceptions.action.compensate")}
        </Link>
      )}
      {actions.includes("clear") && (
        <button type="button" className="btn-primary px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => clearExceptionAction([itemId]))}>
          {t(clearLabelKey(pool))}
        </button>
      )}
    </div>
  );
}
