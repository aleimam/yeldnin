import { describe, it, expect } from "vitest";
import { isEmployeePhotoKind, wouldCreateCycle, validateNewEmployee } from "./hr-logic";

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
});
