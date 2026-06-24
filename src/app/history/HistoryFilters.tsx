"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

/** Filter the events list by item UID / product name (URL-backed; resets page). */
export function HistoryFilters({ basePath, current }: { basePath: string; current: { q: string } }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(current.q);

  const push = () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 max-w-md">
      <input
        className="input"
        placeholder={t("history.filterPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push(); }}
      />
    </div>
  );
}
