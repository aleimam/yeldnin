// Pure FX helpers for converting handling fees to the EGP base. No DB/IO.
// (XOONX P&L keeps its own admin-set monthly rates; these live rates are for
//  operational cost visibility on logistics containers only.)

export const FX_BASE = "EGP";
export const HANDLING_CURRENCIES = ["EGP", "USD", "GBP", "EUR"] as const;
export type HandlingCurrency = (typeof HANDLING_CURRENCIES)[number];

/**
 * Convert a foreign amount to EGP using cached rates (currency → EGP multiplier).
 * EGP/empty passes through. `missing` flags a foreign amount with no rate so a
 * cost is shown as unknown rather than silently zeroed.
 */
export function convertToBase(
  amount: number | null | undefined,
  currency: string | null | undefined,
  rates: Map<string, number>,
): { egp: number; missing: boolean } {
  const a = amount ?? 0;
  if (!a) return { egp: 0, missing: false };
  const cur = (currency ?? "").toUpperCase();
  if (!cur || cur === FX_BASE) return { egp: a, missing: false };
  const r = rates.get(cur);
  if (r == null || !(r > 0)) return { egp: 0, missing: true };
  return { egp: a * r, missing: false };
}

/** Cached rates with no timestamp, or older than maxAgeHours, should be refreshed. */
export function ratesAreStale(fetchedAt: Date | null | undefined, now: Date, maxAgeHours = 24): boolean {
  if (!fetchedAt) return true;
  return now.getTime() - fetchedAt.getTime() >= maxAgeHours * 3600_000;
}

/**
 * From an EGP-based rate table (EGP → X, as returned by the API) produce the
 * X → EGP multipliers we store and convert with. Skips the base and any
 * non-positive entry.
 */
export function egpBaseToMultipliers(
  apiRates: Record<string, number>,
  currencies: readonly string[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const cur of currencies) {
    if (cur === FX_BASE) continue;
    const egpToX = apiRates[cur];
    if (egpToX != null && egpToX > 0) m.set(cur, 1 / egpToX);
  }
  return m;
}
