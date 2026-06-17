"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { useDropdown } from "@/lib/use-dropdown";
import { searchAction } from "@/lib/search/actions";
import type { SearchGroup } from "@/lib/search/search-service";

/** Header type-ahead: debounced, grouped dropdown + keyboard nav; Enter on the
 *  query (or "see all") opens the full /search page. */
export function GlobalSearch() {
  const t = useT();
  const router = useRouter();
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const reqId = useRef(0);

  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const handle = setTimeout(async () => {
      try {
        const res = await searchAction(query);
        if (id === reqId.current) {
          setGroups(res);
          setActive(-1);
        }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    setGroups([]);
    router.push(href);
  }
  function seeAll() {
    if (q.trim().length >= 2) go(`/search?q=${encodeURIComponent(q.trim())}`);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && flat[active]) go(flat[active].href);
      else seeAll();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const show = open && q.trim().length >= 2;

  return (
    <div className="relative hidden flex-1 justify-center md:flex" ref={ref}>
      <div className="relative w-full max-w-sm">
        <input
          className="input w-full"
          placeholder={t("common.search")}
          aria-label={t("common.search")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {show && (
          <div className="absolute inset-x-0 top-full z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
            {loading && flat.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted">{t("search.searching")}</div>
            )}
            {!loading && flat.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted">{t("search.noResults")}</div>
            )}
            {groups.map((g) => (
              <div key={g.type} className="border-b border-line/60 last:border-0">
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {t(g.labelKey)}
                </div>
                {g.hits.map((h) => {
                  const idx = flat.indexOf(h);
                  return (
                    <button
                      key={`${h.type}-${h.id}`}
                      type="button"
                      onClick={() => go(h.href)}
                      onMouseEnter={() => setActive(idx)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-canvas ${active === idx ? "bg-canvas" : ""}`}
                    >
                      <span className="truncate text-ink">{h.title}</span>
                      {h.subtitle && <span className="shrink-0 truncate text-xs text-muted">{h.subtitle}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
            {flat.length > 0 && (
              <button
                type="button"
                onClick={seeAll}
                className="block w-full px-3 py-2 text-start text-xs font-medium text-brand hover:bg-canvas"
              >
                {t("search.seeAll")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
