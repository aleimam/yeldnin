"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

type Current = { q: string; module: string };

/** Audit filters: module + free-text search (URL-backed; resets to page 1). */
export function AuditFilters({ basePath, current, modules }: { basePath: string; current: Current; modules: string[] }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(current.q);

  const push = (next: Partial<Current>) => {
    const merged = { ...current, q, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.module) params.set("module", merged.module);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <input
        className="input lg:col-span-2"
        placeholder={t("audit.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push({}); }}
      />
      <select className="input" aria-label={t("audit.module")} value={current.module} onChange={(e) => push({ module: e.target.value })}>
        <option value="">{t("audit.allModules")}</option>
        {modules.map((k) => <option key={k} value={k}>{t(`module.${k}.name`)}</option>)}
      </select>
    </div>
  );
}
