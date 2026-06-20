// Money + quantity display, consistent across the app. Like formatBizDate, the
// format is deliberately STABLE (Western grouping, up to 2 decimals) rather than
// locale-switching, so the same figure reads identically in English and Arabic.

/** Format an EGP amount: grouped thousands, up to 2 decimals, no currency word. */
export function formatEgp(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Grams → "1.2 kg". */
export function kg(grams: number | null | undefined): string {
  if (grams == null || Number.isNaN(grams)) return "—";
  return `${(grams / 1000).toFixed(1)} kg`;
}
