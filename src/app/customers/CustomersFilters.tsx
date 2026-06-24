"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

type Current = { q: string; scope: string; sort: string };

/** Customers filters + sort (URL-backed; resets to page 1; preserves ?m=). */
export function CustomersFilters({
  basePath,
  current,
  scopes,
  m,
}: {
  basePath: string;
  current: Current;
  scopes: string[];
  m?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(current.q);

  const push = (next: Partial<Current>) => {
    const merged = { ...current, q, ...next };
    const params = new URLSearchParams();
    if (m) params.set("m", m);
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.scope) params.set("scope", merged.scope);
    if (merged.sort) params.set("sort", merged.sort);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input
        className="input"
        placeholder={t("customers.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push({}); }}
      />
      {scopes.length > 1 && (
        <select className="input" aria-label={t("requests.scope")} value={current.scope} onChange={(e) => push({ scope: e.target.value })}>
          <option value="">{t("customers.allScopes")}</option>
          {scopes.map((s) => <option key={s} value={s}>{t(`scope.${s}`)}</option>)}
        </select>
      )}
      <select className="input" aria-label={t("common.sort")} value={current.sort} onChange={(e) => push({ sort: e.target.value })}>
        <option value="">{t("customers.sortNewest")}</option>
        <option value="name">{t("customers.sortName")}</option>
      </select>
    </div>
  );
}
