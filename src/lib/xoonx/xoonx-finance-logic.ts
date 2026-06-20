// Pure XOONX finance helpers (months, FX conversion, profit split). No DB/IO.

export const PETTY_CASH_START = 20000; // EGP — shared petty-cash float
export const STAFF_POOL_PCT = 25; // staff share of net profit (fixed)
export const YELDN_PCT = 75; // owner share (fixed)
export const FX_CURRENCIES = ["USD", "GBP", "EUR"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Month bucketing is UTC throughout, so a transaction near a month boundary is
// attributed to the same financial month regardless of the server's timezone.
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split("-").map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

/** A month can be closed once it has ended + 7 days have passed. */
export function monthCloseable(month: string, now: Date): boolean {
  const { lt } = monthRange(month);
  return now.getTime() >= lt.getTime() + 7 * 24 * 60 * 60 * 1000;
}

/**
 * Convert a foreign amount to EGP using the month's rate. EGP/empty passes
 * through. `missing` is true when a foreign rate is needed but not set (or ≤0),
 * so a cost is never silently zeroed and the month stays not-closeable.
 */
export function toEgp(
  amount: number | null | undefined,
  currency: string | null | undefined,
  rates: Map<string, number>,
): { egp: number; missing: boolean } {
  const a = amount ?? 0;
  if (!a) return { egp: 0, missing: false };
  const cur = (currency ?? "").toUpperCase();
  if (!cur || cur === "EGP") return { egp: a, missing: false };
  const r = rates.get(cur);
  if (r == null || !(r > 0)) return { egp: 0, missing: true };
  return { egp: a * r, missing: false };
}

/**
 * Staff shares must be all-zero (→ equal default applied elsewhere) or total
 * 100%. Returns an error message, or null when valid.
 */
export function validateStaffShares(shares: { sharePct: number }[]): string | null {
  for (const s of shares) if (!(s.sharePct >= 0)) return "Share % cannot be negative.";
  const total = shares.reduce((sum, s) => sum + s.sharePct, 0);
  // Exact 100% (within float noise). `Math.round` previously accepted 99.5–100.49,
  // letting ±0.5% of every month's profit silently misallocate.
  if (total !== 0 && Math.abs(total - 100) > 0.01) return `Staff shares must total 100% (got ${round2(total)}%).`;
  return null;
}
