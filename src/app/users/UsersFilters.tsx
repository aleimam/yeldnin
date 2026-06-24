"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

const TIERS = ["SUPER_ADMIN", "ADMIN", "MEMBER", "THIRD_PARTY"];
type Current = { q: string; tier: string; team: string; active: string; sort: string };

/** Users filters + sort (URL-backed; resets to page 1). */
export function UsersFilters({
  basePath,
  current,
  teams,
}: {
  basePath: string;
  current: Current;
  teams: { key: string; name: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(current.q);

  const push = (next: Partial<Current>) => {
    const merged = { ...current, q, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.tier) params.set("tier", merged.tier);
    if (merged.team) params.set("team", merged.team);
    if (merged.active) params.set("active", merged.active);
    if (merged.sort) params.set("sort", merged.sort);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <input
        className="input"
        placeholder={t("users.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push({}); }}
      />
      <select className="input" aria-label={t("users.tier")} value={current.tier} onChange={(e) => push({ tier: e.target.value })}>
        <option value="">{t("users.allTiers")}</option>
        {TIERS.map((tr) => <option key={tr} value={tr}>{t(`tier.${tr}`)}</option>)}
      </select>
      <select className="input" aria-label={t("users.teams")} value={current.team} onChange={(e) => push({ team: e.target.value })}>
        <option value="">{t("users.allTeams")}</option>
        {teams.map((tm) => <option key={tm.key} value={tm.key}>{tm.name}</option>)}
      </select>
      <select className="input" aria-label={t("users.status")} value={current.active} onChange={(e) => push({ active: e.target.value })}>
        <option value="">{t("users.allStatuses")}</option>
        <option value="1">{t("users.active")}</option>
        <option value="0">{t("users.inactive")}</option>
      </select>
      <select className="input" aria-label={t("common.sort")} value={current.sort} onChange={(e) => push({ sort: e.target.value })}>
        <option value="">{t("users.sortName")}</option>
        <option value="newest">{t("users.sortNewest")}</option>
      </select>
    </div>
  );
}
