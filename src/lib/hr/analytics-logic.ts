// Pure HR-analytics helpers (Phase 5). No DB/IO. Unit-tested.
import { round2 } from "./salary-logic";

/** Arithmetic mean, rounded to 2dp. 0 for an empty set. */
export function average(nums: number[]): number {
  if (!nums.length) return 0;
  return round2(nums.reduce((s, n) => s + n, 0) / nums.length);
}

/** Median, rounded to 2dp. 0 for an empty set; mean of the two middles when even. */
export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return round2(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

/** Group-sum: total of valFn over items, bucketed by keyFn. */
export function sumByKey<T>(items: T[], keyFn: (t: T) => string, valFn: (t: T) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = keyFn(it);
    out[k] = round2((out[k] ?? 0) + valFn(it));
  }
  return out;
}

/** The last `n` calendar months ending at (year, month), oldest → newest. */
export function recentMonths(year: number, month: number, n: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = year;
  let m = month;
  for (let i = 0; i < n; i++) {
    out.push({ year: y, month: m });
    if (m <= 1) {
      m = 12;
      y -= 1;
    } else {
      m -= 1;
    }
  }
  return out.reverse();
}

/** "YYYY-MM" key/label for a month. */
export function monthLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
