import { describe, it, expect } from "vitest";
import { formatBizDate } from "./dates";

const now = new Date("2026-06-17T00:00:00.000Z");

describe("formatBizDate", () => {
  it("drops the year for the current year", () => {
    expect(formatBizDate("2026-07-17", now)).toBe("17 Jul");
    expect(formatBizDate(new Date("2026-01-05T00:00:00Z"), now)).toBe("05 Jan");
  });
  it("shows the year for other years", () => {
    expect(formatBizDate("2027-07-17", now)).toBe("17 Jul 2027");
    expect(formatBizDate("2025-12-31", now)).toBe("31 Dec 2025");
  });
  it("ignores the time component (UTC date)", () => {
    expect(formatBizDate("2026-07-17T23:30:00.000Z", now)).toBe("17 Jul");
  });
  it("returns a dash for empty/invalid input", () => {
    expect(formatBizDate(null, now)).toBe("—");
    expect(formatBizDate(undefined, now)).toBe("—");
    expect(formatBizDate("not-a-date", now)).toBe("—");
  });
});
