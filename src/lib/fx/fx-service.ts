import "server-only";
import { prisma } from "@/lib/db";
import { HANDLING_CURRENCIES, ratesAreStale, egpBaseToMultipliers, convertToBase } from "./fx-logic";

// Free, no-key public endpoint. EGP base → other-currency rates; we invert to
// store X→EGP multipliers. If the call fails (e.g. no egress), the last cache
// is kept and conversions degrade to "rate unavailable" rather than wrong math.
const API_URL = "https://open.er-api.com/v6/latest/EGP";

export interface HandlingRates {
  rates: Map<string, number>; // currency → EGP multiplier
  fetchedAt: Date | null;
  stale: boolean;
}

async function readCache(): Promise<{ rates: Map<string, number>; fetchedAt: Date | null }> {
  const rows = await prisma.fxRateCache.findMany();
  const rates = new Map(rows.map((r) => [r.currency, r.rate]));
  const fetchedAt = rows.reduce<Date | null>((max, r) => (!max || r.fetchedAt > max ? r.fetchedAt : max), null);
  return { rates, fetchedAt };
}

/**
 * Fetch EGP-based rates from the public API and cache currency→EGP multipliers.
 * On any failure the previous cache is left intact. Returns true on success.
 */
export async function refreshRates(): Promise<boolean> {
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates) return false;
    const mult = egpBaseToMultipliers(data.rates, HANDLING_CURRENCIES);
    if (!mult.size) return false;
    const now = new Date();
    for (const [currency, rate] of mult) {
      await prisma.fxRateCache.upsert({
        where: { currency },
        update: { rate, fetchedAt: now },
        create: { currency, rate, fetchedAt: now },
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** Current handling-fee rates, refreshing at most once a day (best-effort). */
export async function getHandlingRates(now: Date = new Date()): Promise<HandlingRates> {
  let { rates, fetchedAt } = await readCache();
  if (ratesAreStale(fetchedAt, now)) {
    const ok = await refreshRates();
    if (ok) ({ rates, fetchedAt } = await readCache());
  }
  return { rates, fetchedAt, stale: ratesAreStale(fetchedAt, now) };
}

/** Convert one handling fee to EGP using today's cached rates. */
export async function handlingFeeInEgp(
  amount: number | null | undefined,
  currency: string | null | undefined,
): Promise<{ egp: number; missing: boolean }> {
  const { rates } = await getHandlingRates();
  return convertToBase(amount, currency, rates);
}
