"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PRODUCT_TYPES } from "@/lib/products/products-logic";

type Current = { q: string; scope: string; type: string; active: string; sort: string };

/** Products filters + sort. URL-backed; changing any filter resets to page 1.
 *  Preserves the module-context param (?m=). */
export function ProductsFilters({
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
    if (merged.type) params.set("type", merged.type);
    if (merged.active) params.set("active", merged.active);
    if (merged.sort) params.set("sort", merged.sort);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <input
        className="input"
        placeholder={t("products.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push({}); }}
      />
      {scopes.length > 1 && (
        <select className="input" aria-label={t("products.scope")} value={current.scope} onChange={(e) => push({ scope: e.target.value })}>
          <option value="">{t("products.allScopes")}</option>
          {scopes.map((s) => <option key={s} value={s}>{t(`scope.${s}`)}</option>)}
        </select>
      )}
      <select className="input" aria-label={t("products.type")} value={current.type} onChange={(e) => push({ type: e.target.value })}>
        <option value="">{t("products.allTypes")}</option>
        {PRODUCT_TYPES.map((pt) => <option key={pt} value={pt}>{t(`ptype.${pt}`)}</option>)}
      </select>
      <select className="input" aria-label={t("products.status")} value={current.active} onChange={(e) => push({ active: e.target.value })}>
        <option value="">{t("products.allStatuses")}</option>
        <option value="1">{t("products.activeOnly")}</option>
        <option value="0">{t("products.inactiveOnly")}</option>
      </select>
      <select className="input" aria-label={t("common.sort")} value={current.sort} onChange={(e) => push({ sort: e.target.value })}>
        <option value="">{t("products.sortNewest")}</option>
        <option value="name">{t("products.sortName")}</option>
        <option value="sku">{t("products.sortSku")}</option>
      </select>
    </div>
  );
}
