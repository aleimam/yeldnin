import { describe, it, expect } from "vitest";
import { parseWeeklyOff, ymd, countWorkingDays, expandHolidayKeys, effectiveAllowance, validateLeaveRequest, isLeaveType, isComponentKind, isDayClass, dutyCodeFor } from "./attendance-logic";

const utc = (s: string) => new Date(`${s}T00:00:00Z`);

describe("attendance-logic", () => {
  it("parses the weekly-off CSV, filtering junk", () => {
    expect([...parseWeeklyOff("5,6")]).toEqual([5, 6]);
    expect([...parseWeeklyOff("5, 6 ,9,abc,-1")]).toEqual([5, 6]);
    expect(parseWeeklyOff("").size).toBe(0);
    expect(parseWeeklyOff(null).size).toBe(0);
  });

  it("ymd uses UTC date parts", () => {
    expect(ymd(utc("2026-06-05"))).toBe("2026-06-05");
  });

  it("counts working days, skipping weekly-off + holidays", () => {
    const none = new Set<number>();
    // 10-day span, nothing off
    expect(countWorkingDays(utc("2026-06-01"), utc("2026-06-10"), none, new Set())).toBe(10);
    // everything off → 0
    expect(countWorkingDays(utc("2026-06-01"), utc("2026-06-10"), new Set([0, 1, 2, 3, 4, 5, 6]), new Set())).toBe(10 - 10);
    // two holiday days removed
    expect(countWorkingDays(utc("2026-06-01"), utc("2026-06-10"), none, new Set(["2026-06-03", "2026-06-04"]))).toBe(8);
    // end before start → 0
    expect(countWorkingDays(utc("2026-06-10"), utc("2026-06-01"), none, new Set())).toBe(0);
    // single day, working
    expect(countWorkingDays(utc("2026-06-02"), utc("2026-06-02"), none, new Set())).toBe(1);
  });

  it("expands holiday ranges into date keys", () => {
    const keys = expandHolidayKeys([{ startDate: utc("2026-06-03"), endDate: utc("2026-06-04") }]);
    expect([...keys].sort()).toEqual(["2026-06-03", "2026-06-04"]);
    expect(keys.size).toBe(2);
  });

  it("effectiveAllowance prefers the override", () => {
    expect(effectiveAllowance(15, 21)).toBe(15);
    expect(effectiveAllowance(null, 21)).toBe(21);
    expect(effectiveAllowance(undefined, 7)).toBe(7);
    expect(effectiveAllowance(0, 21)).toBe(0); // explicit zero is honored
  });

  it("validates a leave request", () => {
    expect(Object.keys(validateLeaveRequest({ type: "ANNUAL", startDate: "2026-06-01", endDate: "2026-06-03" }))).toHaveLength(0);
    expect(validateLeaveRequest({ startDate: "2026-06-01", endDate: "2026-06-03" }).type).toBeTruthy();
    expect(validateLeaveRequest({ type: "URGENT", startDate: "2026-06-05", endDate: "2026-06-01" }).endDate).toBeTruthy();
    expect(isLeaveType("ANNUAL")).toBe(true);
    expect(isLeaveType("SICK")).toBe(false);
  });

  it("catalog kinds + vacation→duty mapping", () => {
    expect(isComponentKind("BONUS")).toBe(true);
    expect(isComponentKind("X")).toBe(false);
    expect(isDayClass("DUTY")).toBe(true);
    expect(isDayClass("HOLIDAY")).toBe(false);
    const m = { dutyEidDays: "ED", dutyEidVacation: "D", dutyVacation: "VD", dutyWeekend: "D" };
    expect(dutyCodeFor("EID_DAYS", m)).toBe("ED");
    expect(dutyCodeFor("EID_VACATION", m)).toBe("D");
    expect(dutyCodeFor("VACATION", m)).toBe("VD");
    expect(dutyCodeFor("WEEKEND", m)).toBe("D");
  });
});
