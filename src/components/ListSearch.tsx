"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Generic single-box search filter for list pages (URL-backed via ?q=, resets to
 * page 1). `extra` carries any other params that must survive the navigation
 * (e.g. a module context or scope). Pairs with the shared <Paginator>.
 */
export function ListSearch({
  basePath,
  value,
  placeholder,
  extra,
}: {
  basePath: string;
  value: string;
  placeholder: string;
  extra?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [q, setQ] = useState(value);

  const go = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extra ?? {})) if (v) params.set(k, v);
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 max-w-md">
      <input
        className="input"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") go(); }}
      />
    </div>
  );
}
