"use client";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PER_PAGE_OPTIONS, PER_PAGE_COOKIE, DEFAULT_PER_PAGE, totalPages, pageList } from "@/lib/pagination";

/**
 * Page-number pagination + per-page selector. URL-backed (?page=&perPage=),
 * preserving any other filter params. The chosen per-page persists across the
 * app via a cookie. Shared by all big lists.
 */
export function Paginator({
  basePath,
  params,
  page,
  perPage,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  perPage: number;
  total: number;
}) {
  const t = useT();
  const router = useRouter();
  const pages = totalPages(total, perPage);
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  const go = (next: { page?: number; perPage?: number }) => {
    const p = next.page ?? page;
    const pp = next.perPage ?? perPage;
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "" && k !== "page" && k !== "perPage") merged[k] = v;
    }
    if (p > 1) merged.page = String(p);
    if (pp !== DEFAULT_PER_PAGE) merged.perPage = String(pp);
    const qs = new URLSearchParams(merged).toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  const setPerPage = (pp: number) => {
    document.cookie = `${PER_PAGE_COOKIE}=${pp}; path=/; max-age=${60 * 60 * 24 * 365}`;
    go({ perPage: pp, page: 1 });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-muted">
        <span>{t("page.showing", { from, to, total })}</span>
        <select
          className="input h-8 w-auto py-0 text-xs"
          aria-label={t("page.perPage")}
          value={perPage}
          onChange={(e) => setPerPage(Number(e.target.value))}
        >
          {PER_PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>{t("page.perPageN", { n })}</option>
          ))}
        </select>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className="btn-secondary btn-xs" disabled={page <= 1} onClick={() => go({ page: page - 1 })} aria-label={t("page.prev")}>
            <span className="rtl-flip">←</span>
          </button>
          {pageList(page, pages).map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1 text-muted">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => go({ page: n })}
                aria-current={n === page ? "page" : undefined}
                className={`h-7 min-w-7 rounded px-2 text-xs ${n === page ? "bg-brand text-brand-fg" : "text-ink hover:bg-canvas"}`}
              >
                {n}
              </button>
            ),
          )}
          <button type="button" className="btn-secondary btn-xs" disabled={page >= pages} onClick={() => go({ page: page + 1 })} aria-label={t("page.next")}>
            <span className="rtl-flip">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
