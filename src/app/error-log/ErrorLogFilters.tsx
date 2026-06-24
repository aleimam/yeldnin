"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

const ERROR_LEVELS = ["error", "warn", "info"] as const;
type Current = { q: string; level: string; source: string };

/** Error-log filters: level + source + free-text search (URL-backed; resets page). */
export function ErrorLogFilters({ basePath, current, sources }: { basePath: string; current: Current; sources: string[] }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(current.q);

  const push = (next: Partial<Current>) => {
    const merged = { ...current, q, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.level) params.set("level", merged.level);
    if (merged.source) params.set("source", merged.source);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input
        className="input lg:col-span-2"
        placeholder={t("errlog.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push({}); }}
      />
      <select className="input" aria-label={t("errlog.level")} value={current.level} onChange={(e) => push({ level: e.target.value })}>
        <option value="">{t("errlog.allLevels")}</option>
        {ERROR_LEVELS.map((l) => <option key={l} value={l}>{t(`errlog.lvl.${l}`)}</option>)}
      </select>
      <select className="input" aria-label={t("errlog.source")} value={current.source} onChange={(e) => push({ source: e.target.value })}>
        <option value="">{t("errlog.allSources")}</option>
        {sources.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}
