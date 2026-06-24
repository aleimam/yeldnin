"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { TRIP_STATUSES } from "@/lib/trips/trip-logic";

type Current = { q: string; status: string; sort: string };

/** Trips filters + sort (URL-backed; resets to page 1). */
export function TripsFilters({ basePath, current }: { basePath: string; current: Current }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(current.q);

  const push = (next: Partial<Current>) => {
    const merged = { ...current, q, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.status) params.set("status", merged.status);
    if (merged.sort) params.set("sort", merged.sort);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <input
        className="input"
        placeholder={t("trip.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push({}); }}
      />
      <select className="input" aria-label={t("trip.status")} value={current.status} onChange={(e) => push({ status: e.target.value })}>
        <option value="">{t("trip.allStatuses")}</option>
        {TRIP_STATUSES.map((s) => <option key={s} value={s}>{t(`tripstatus.${s}`)}</option>)}
      </select>
      <select className="input" aria-label={t("common.sort")} value={current.sort} onChange={(e) => push({ sort: e.target.value })}>
        <option value="">{t("trip.sortNearest")}</option>
        <option value="newest">{t("trip.sortNewest")}</option>
      </select>
    </div>
  );
}
