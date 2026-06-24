import { describe, it, expect } from "vitest";
import {
  isEmployeePhotoKind,
  wouldCreateCycle,
  validateNewEmployee,
  nextEmployeeNumber,
  isValidEmployeeNumber,
  isAdminTier,
  serviceMonthsInYear,
  proratedAllowance,
} from "./hr-logic";

describe("hr-logic", () => {
  it("recognizes employee photo kinds", () => {
    for (const k of ["ID_FRONT", "ID_BACK", "GRAD_CERT", "BIRTH_CERT", "OTHER"]) expect(isEmployeePhotoKind(k)).toBe(true);
    expect(isEmployeePhotoKind("PASSPORT")).toBe(false);
    expect(isEmployeePhotoKind(null)).toBe(false);
  });

  describe("wouldCreateCycle", () => {
    // chain: 1 ← 2 ← 3  (parentOf: 3→2, 2→1, 1→null)
    const parents: Record<number, number | null> = { 1: null, 2: 1, 3: 2 };
    const parentOf = (id: number) => parents[id] ?? null;

    it("rejects managing yourself", () => {
      expect(wouldCreateCycle(1, 1, parentOf)).toBe(true);
    });
    it("rejects a manager who reports up to the employee (direct + deep)", () => {
      expect(wouldCreateCycle(1, 2, parentOf)).toBe(true); // 2 reports to 1 → loop
      expect(wouldCreateCycle(1, 3, parentOf)).toBe(true); // 3 → 2 → 1 → loop
    });
    it("allows a valid manager", () => {
      expect(wouldCreateCycle(3, 1, parentOf)).toBe(false); // 3 under 1: fine
      expect(wouldCreateCycle(2, 3, () => null)).toBe(false);
    });
    it("does not hang on a pre-existing cycle in the data", () => {
      const bad = (id: number) => (id === 5 ? 6 : id === 6 ? 5 : null);
      expect(wouldCreateCycle(9, 5, bad)).toBe(false); // 9 not in the 5↔6 loop
    });
  });

  it("validates the minimal new-employee inputs", () => {
    expect(Object.keys(validateNewEmployee({ name: "Sara", email: "s@x.com" }))).toHaveLength(0);
    expect(validateNewEmployee({ email: "s@x.com" }).name).toBeTruthy();
    expect(validateNewEmployee({ name: "Sara" }).email).toBeTruthy();
    expect(validateNewEmployee({ name: "Sara", email: "nope" }).email).toBeTruthy();
  });

  describe("employee number", () => {
    it("validates the YE#### format", () => {
      expect(isValidEmployeeNumber("YE1101")).toBe(true);
      expect(isValidEmployeeNumber("YE1001")).toBe(true);
      expect(isValidEmployeeNumber("YE12")).toBe(false); // too short
      expect(isValidEmployeeNumber("1101")).toBe(false);
      expect(isValidEmployeeNumber(null)).toBe(false);
    });
    it("classifies admin tiers", () => {
      expect(isAdminTier("ADMIN")).toBe(true);
      expect(isAdminTier("SUPER_ADMIN")).toBe(true);
      expect(isAdminTier("MEMBER")).toBe(false);
      expect(isAdminTier("THIRD_PARTY")).toBe(false);
      expect(isAdminTier(null)).toBe(false);
    });
    it("starts each band at its base when empty", () => {
      expect(nextEmployeeNumber([], true)).toBe("YE1001");
      expect(nextEmployeeNumber([], false)).toBe("YE1101");
    });
    it("continues from the highest used in the band", () => {
      expect(nextEmployeeNumber(["YE1101", "YE1102", "YE1201"], false)).toBe("YE1202");
      expect(nextEmployeeNumber(["YE1001", "YE1005"], true)).toBe("YE1006");
    });
    it("keeps the admin band below the staff band", () => {
      // staff numbers present shouldn't bump an admin hire past its band
      expect(nextEmployeeNumber(["YE1101", "YE1102"], true)).toBe("YE1001");
    });
    it("skips numbers already taken", () => {
      expect(nextEmployeeNumber(["YE1101", "YE1102"], false)).toBe("YE1103");
    });
  });

  describe("leave proration", () => {
    it("counts months of service in the hire year (hire month is full)", () => {
      expect(serviceMonthsInYear(new Date(Date.UTC(2026, 6, 15)), 2026)).toBe(6); // hired Jul → Jul..Dec
      expect(serviceMonthsInYear(new Date(Date.UTC(2026, 0, 1)), 2026)).toBe(12); // Jan
      expect(serviceMonthsInYear(new Date(Date.UTC(2025, 5, 1)), 2026)).toBe(12); // hired before
      expect(serviceMonthsInYear(new Date(Date.UTC(2027, 0, 1)), 2026)).toBe(0); // hired after
      expect(serviceMonthsInYear(null, 2026)).toBe(12);
    });
    it("pro-rates the allowance (round half-up)", () => {
      expect(proratedAllowance(21, new Date(Date.UTC(2026, 6, 1)), 2026)).toBe(11); // 21×6/12 = 10.5 → 11
      expect(proratedAllowance(21, new Date(Date.UTC(2026, 0, 1)), 2026)).toBe(21); // full year
      expect(proratedAllowance(21, new Date(Date.UTC(2027, 0, 1)), 2026)).toBe(0); // not yet hired
      expect(proratedAllowance(7, new Date(Date.UTC(2026, 9, 1)), 2026)).toBe(2); // 7×3/12 = 1.75 → 2
    });
  });
});
