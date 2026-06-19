"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/i18n/client";
import type { ResolutionAction } from "@/lib/exceptions/exception-logic";
import { recoverItemAction, rebuyReplacementAction, closeExceptionAction, convertErrantAction, assignDelayedAction } from "./actions";

interface Picker {
  id: number;
  label: string;
}

export function ExceptionActions({
  itemId,
  actions,
  hasRequest,
  issueId,
  trips,
  hubs,
  travelers,
}: {
  itemId: number;
  pool: string;
  actions: ResolutionAction[];
  hasRequest: boolean;
  issueId: number | null;
  trips: Picker[];
  hubs: Picker[];
  travelers: Picker[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [recoverDest, setRecoverDest] = useState("ORIGINAL");
  const [tripTarget, setTripTarget] = useState("");
  const [outcome, setOutcome] = useState<"COMPENSATED" | "NO_COMPENSATION">("COMPENSATED");

  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {actions.includes("recover") && (
        <span className="flex items-center gap-1">
          <select className="input h-8 w-40 py-0 text-xs" value={recoverDest} onChange={(e) => setRecoverDest(e.target.value)} disabled={pending}>
            <option value="ORIGINAL">{t("exceptions.dest.original")}</option>
            <optgroup label={t("container.HUB")}>
              {hubs.map((h) => <option key={`H${h.id}`} value={`HUB:${h.id}`}>{h.label}</option>)}
            </optgroup>
            <optgroup label={t("container.TRIP")}>
              {trips.map((tr) => <option key={`T${tr.id}`} value={`TRIP:${tr.id}`}>{tr.label}</option>)}
            </optgroup>
            <optgroup label={t("transfers.holding")}>
              {travelers.map((tv) => <option key={`V${tv.id}`} value={`TRAVELER:${tv.id}`}>{tv.label}</option>)}
            </optgroup>
          </select>
          <button
            type="button"
            className="btn-primary px-2 py-1 text-xs"
            disabled={pending}
            onClick={() => {
              const [kind, id] = recoverDest.split(":");
              run(() => recoverItemAction([itemId], kind as "ORIGINAL" | "HUB" | "TRIP" | "TRAVELER", id ? Number(id) : undefined));
            }}
          >
            {t("exceptions.action.recover")}
          </button>
        </span>
      )}
      {actions.includes("assignTrip") && (
        <span className="flex items-center gap-1">
          <select className="input h-8 w-36 py-0 text-xs" value={tripTarget} onChange={(e) => setTripTarget(e.target.value)} disabled={pending}>
            <option value="">{t("exceptions.pickTrip")}</option>
            {trips.map((tr) => <option key={tr.id} value={tr.id}>{tr.label}</option>)}
          </select>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending || !tripTarget} onClick={() => run(() => assignDelayedAction([itemId], Number(tripTarget)))}>
            {t("exceptions.action.assignTrip")}
          </button>
        </span>
      )}
      {actions.includes("rebuy") && (
        <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending || !hasRequest} onClick={() => run(() => rebuyReplacementAction([itemId]))}>
          {t("exceptions.action.rebuy")}
        </button>
      )}
      {actions.includes("convertLost") && (
        <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => convertErrantAction([itemId], "LOST"))}>
          {t("exceptions.action.convertLost")}
        </button>
      )}
      {actions.includes("convertDamaged") && (
        <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => convertErrantAction([itemId], "DAMAGED"))}>
          {t("exceptions.action.convertDamaged")}
        </button>
      )}
      {actions.includes("compensate") && issueId && (
        <Link href={`/issues/${issueId}`} className="btn-secondary px-2 py-1 text-xs">{t("exceptions.action.compensate")}</Link>
      )}
      {actions.includes("close") && (
        <span className="flex items-center gap-1">
          <select className="input h-8 w-36 py-0 text-xs" value={outcome} onChange={(e) => setOutcome(e.target.value as "COMPENSATED" | "NO_COMPENSATION")} disabled={pending}>
            <option value="COMPENSATED">{t("exceptions.outcome.COMPENSATED")}</option>
            <option value="NO_COMPENSATION">{t("exceptions.outcome.NO_COMPENSATION")}</option>
          </select>
          <button type="button" className="btn-danger px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => closeExceptionAction([itemId], outcome))}>
            {t("exceptions.action.close")}
          </button>
        </span>
      )}
    </div>
  );
}
