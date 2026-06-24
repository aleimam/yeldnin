// Pure pagination helpers (no DB/IO). Unit-tested. Shared by all paginated lists.

export const PER_PAGE_OPTIONS = [25, 50, 100, 200] as const;
export const DEFAULT_PER_PAGE = 50;
export const PER_PAGE_COOKIE = "yeldnin_perpage";

export function clampPerPage(v: number | undefined | null): number {
  return v != null && (PER_PAGE_OPTIONS as readonly number[]).includes(v) ? v : DEFAULT_PER_PAGE;
}

export function parsePageNum(v: string | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export interface PageWindow {
  page: number;
  perPage: number;
  skip: number;
  take: number;
}

/**
 * Resolve the query window from raw `?page`/`?perPage` strings, falling back to
 * the user's cookie default then the global default. `skip`/`take` feed Prisma.
 */
export function pageWindow(opts: { page?: string; perPage?: string; cookiePerPage?: number }): PageWindow {
  const perPage = clampPerPage(opts.perPage != null && opts.perPage !== "" ? Number(opts.perPage) : opts.cookiePerPage);
  const page = parsePageNum(opts.page);
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

export function totalPages(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, perPage)));
}

/**
 * Compact page-number sequence with ellipses for the control, always including
 * first/last and a window around the current page. `pages` is the total page
 * count. E.g. (5, 20) → [1, "…", 4, 5, 6, "…", 20].
 */
export function pageList(current: number, pages: number, window = 1): (number | "…")[] {
  const last = Math.max(1, pages);
  const cur = Math.min(Math.max(1, current), last);
  const nums = new Set<number>([1, last]);
  for (let i = cur - window; i <= cur + window; i++) if (i >= 1 && i <= last) nums.add(i);
  const sorted = [...nums].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}
