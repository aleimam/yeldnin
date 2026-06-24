"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PURCHASE_STATUSES } from "@/lib/purchasing/purchasing-logic";

type Current = { q: string; status: string };

/** Purchases filters (URL-backed; resets to page 1). */
export function PurchasesFilters({ basePath, current }: { basePath: string; current: Current }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(current.q);

  const push = (next: Partial<Current>) => {
    const merged = { ...current, q, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.status) params.set("status", merged.status);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <input
        className="input lg:col-span-2"
        placeholder={t("purchasing.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push({}); }}
      />
      <select className="input" aria-label={t("purchasing.status")} value={current.status} onChange={(e) => push({ status: e.target.value })}>
        <option value="">{t("purchasing.allStatuses")}</option>
        {PURCHASE_STATUSES.map((s) => <option key={s} value={s}>{t(`purchasestatus.${s}`)}</option>)}
      </select>
    </div>
  );
}
