// Business-date display. Per the agreed style: "17 Jul" for dates in the current
// year, "17 Jul 2027" for any other year. Time is intentionally dropped — these
// are user-entered / system-calculated dates (delivery, receiving, expense
// dates), not timestamps. Uses UTC parts so a date stored at UTC-midnight never
// drifts a day across timezones, and a fixed English month so it reads the same
// in both locales (matches the requested "17 Jul" format).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatBizDate(date: Date | string | null | undefined, now: Date = new Date()): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return year === now.getUTCFullYear() ? `${day} ${mon}` : `${day} ${mon} ${year}`;
}
