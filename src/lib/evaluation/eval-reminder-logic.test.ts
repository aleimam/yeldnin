import { describe, it, expect } from "vitest";
import { sameUtcDay, reminderDueToday, alreadyRemindedToday } from "./eval-reminder-logic";

const d = (s: string) => new Date(s);

describe("sameUtcDay", () => {
  it("matches within a UTC day, not across", () => {
    expect(sameUtcDay(d("2026-07-01T00:01:00Z"), d("2026-07-01T23:59:00Z"))).toBe(true);
    expect(sameUtcDay(d("2026-07-01T23:59:00Z"), d("2026-07-02T00:01:00Z"))).toBe(false);
  });
});

describe("reminderDueToday", () => {
  const open = d("2026-07-01T09:00:00Z");
  const deadline = d("2026-07-31T09:00:00Z");

  it("does not remind on the open day", () => {
    expect(reminderDueToday(open, deadline, d("2026-07-01T12:00:00Z"))).toBe(false);
  });
  it("reminds every 3rd day in the open stretch", () => {
    expect(reminderDueToday(open, deadline, d("2026-07-04T09:00:00Z"))).toBe(true); // +3
    expect(reminderDueToday(open, deadline, d("2026-07-05T09:00:00Z"))).toBe(false); // +4
    expect(reminderDueToday(open, deadline, d("2026-07-07T09:00:00Z"))).toBe(true); // +6
  });
  it("reminds daily in the final 3 days and on the deadline", () => {
    expect(reminderDueToday(open, deadline, d("2026-07-29T09:00:00Z"))).toBe(true); // 2 days left
    expect(reminderDueToday(open, deadline, d("2026-07-30T09:00:00Z"))).toBe(true); // 1 day left
    expect(reminderDueToday(open, deadline, d("2026-07-31T08:00:00Z"))).toBe(true); // deadline day
  });
  it("stops after the deadline passes", () => {
    expect(reminderDueToday(open, deadline, d("2026-08-01T09:00:00Z"))).toBe(false);
  });
});

describe("alreadyRemindedToday", () => {
  const now = d("2026-07-10T15:00:00Z");
  it("is false when never reminded", () => {
    expect(alreadyRemindedToday(null, now)).toBe(false);
  });
  it("is true only when the last reminder was today", () => {
    expect(alreadyRemindedToday(d("2026-07-10T08:00:00Z"), now)).toBe(true);
    expect(alreadyRemindedToday(d("2026-07-09T23:00:00Z"), now)).toBe(false);
  });
});
