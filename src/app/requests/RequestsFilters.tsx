"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { REQUEST_TYPES, REQUEST_STATUSES } from "@/lib/requests/request-logic";

type Current = { q: string; type: string; status: string; m: string };

/** Requests filters (URL-backed; resets to page 1). Preserves the `m` module
 *  context so the dashboard stays scoped to the active section. */
export function RequestsFilters({ basePath, current }: { basePath: string; current: Current }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(current.q);

  const push = (next: Partial<Current>) => {
    const merged = { ...current, q, ...next };
    const params = new URLSearchParams();
    if (merged.m) params.set("m", merged.m);
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.type) params.set("type", merged.type);
    if (merged.status) params.set("status", merged.status);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input
        className="input lg:col-span-2"
        placeholder={t("requests.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push({}); }}
      />
      <select className="input" aria-label={t("requests.type")} value={current.type} onChange={(e) => push({ type: e.target.value })}>
        <option value="">{t("requests.allTypes")}</option>
        {REQUEST_TYPES.map((rt) => <option key={rt} value={rt}>{t(`reqtype.${rt}`)}</option>)}
      </select>
      <select className="input" aria-label={t("req.status")} value={current.status} onChange={(e) => push({ status: e.target.value })}>
        <option value="">{t("requests.allStatuses")}</option>
        {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{t(`reqstatus.${s}`)}</option>)}
      </select>
    </div>
  );
}
