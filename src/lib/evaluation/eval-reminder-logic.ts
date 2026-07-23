// Pure reminder-cadence logic for an open 360 cycle. No DB/IO. Unit-tested.
// Cadence (EVALUATION.md §7): after open → every 3 days → daily in the final
// 3 days → a nudge on the deadline. A daily cron drives it; sameUtcDay dedups so
// a double-fired day never double-notifies.

const DAY = 86_400_000;

/** True when `a` and `b` fall on the same UTC calendar day. */
export function sameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

/** Should today's sweep send a reminder for a cycle opened `startedAt`, due
 *  `deadline`, evaluated at `now`? Never before the day after open, never after
 *  the deadline day. */
export function reminderDueToday(startedAt: Date, deadline: Date, now: Date): boolean {
  const daysSinceOpen = Math.floor((now.getTime() - startedAt.getTime()) / DAY);
  const daysToDeadline = Math.ceil((deadline.getTime() - now.getTime()) / DAY);
  if (daysToDeadline < 0) return false; // past deadline — cycle should be closed
  if (daysToDeadline <= 3) return true; // daily nudges in the final stretch + deadline day
  return daysSinceOpen > 0 && daysSinceOpen % 3 === 0; // every 3rd day otherwise
}

/** Skip the sweep if we already reminded today (dedup against a double cron hit). */
export function alreadyRemindedToday(lastReminderAt: Date | null, now: Date): boolean {
  return lastReminderAt != null && sameUtcDay(lastReminderAt, now);
}
