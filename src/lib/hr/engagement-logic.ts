// Pure HR-engagement logic. No DB/IO. Unit-tested.

/** Sum of bonus amounts (rounded to cents) — an employee's engagement earnings. */
export function bonusTotal(rows: { bonusAmount: number }[]): number {
  return Math.round(rows.reduce((s, r) => s + (r.bonusAmount || 0), 0) * 100) / 100;
}

/** Display title for an event: its override, else the template's name. */
export function eventTitle(event: { title?: string | null }, templateName: string): string {
  return event.title?.trim() || templateName;
}

/** Stable key for an (employee, criterion) cell in the achievement grid. */
export function cellKey(employeeId: number, criterionId: number): string {
  return `${employeeId}:${criterionId}`;
}
