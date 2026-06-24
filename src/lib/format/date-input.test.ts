import { describe, it, expect } from "vitest";
import { isoToDisplay, displayToIso } from "./date-input";

describe("date-input conversions", () => {
  it("isoToDisplay: ISO → dd/mm/yyyy", () => {
    expect(isoToDisplay("2026-06-24")).toBe("24/06/2026");
    expect(isoToDisplay("1990-01-05")).toBe("05/01/1990");
    expect(isoToDisplay("")).toBe("");
    expect(isoToDisplay("nope")).toBe("");
  });
  it("displayToIso: dd/mm/yyyy → ISO", () => {
    expect(displayToIso("24/06/2026")).toBe("2026-06-24");
    expect(displayToIso("5/1/1990")).toBe("1990-01-05"); // single digits padded
    expect(displayToIso(" 31/12/2025 ")).toBe("2025-12-31");
  });
  it("displayToIso: rejects incomplete or out-of-range", () => {
    expect(displayToIso("24/06")).toBe("");
    expect(displayToIso("24/13/2026")).toBe(""); // month > 12
    expect(displayToIso("00/06/2026")).toBe(""); // day 0
    expect(displayToIso("2026-06-24")).toBe(""); // ISO, not display format
    expect(displayToIso("")).toBe("");
  });
  it("round-trips", () => {
    expect(isoToDisplay(displayToIso("07/03/2024"))).toBe("07/03/2024");
    expect(displayToIso(isoToDisplay("2024-03-07"))).toBe("2024-03-07");
  });
});
