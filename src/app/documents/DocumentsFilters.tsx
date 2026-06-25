"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { DOC_STATUSES } from "@/lib/documents/documents-logic";

type Current = { q: string; category: string; status: string };

/** Documents filters: free-text search + category + status (URL-backed; resets to page 1). */
export function DocumentsFilters({
  basePath,
  current,
  categories,
}: {
  basePath: string;
  current: Current;
  categories: { id: number; name: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(current.q);

  const push = (next: Partial<Current>) => {
    const merged = { ...current, q, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.category) params.set("category", merged.category);
    if (merged.status) params.set("status", merged.status);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input
        className="input lg:col-span-2"
        placeholder={t("docs.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push({}); }}
      />
      <select className="input" aria-label={t("docs.category")} value={current.category} onChange={(e) => push({ category: e.target.value })}>
        <option value="">{t("docs.allCategories")}</option>
        {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
      </select>
      <select className="input" aria-label={t("docs.col.status")} value={current.status} onChange={(e) => push({ status: e.target.value })}>
        <option value="">{t("docs.allStatuses")}</option>
        {DOC_STATUSES.map((s) => <option key={s} value={s}>{t(`docs.status.${s}`)}</option>)}
      </select>
    </div>
  );
}
