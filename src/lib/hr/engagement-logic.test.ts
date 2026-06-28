import { describe, it, expect } from "vitest";
import { bonusTotal, eventTitle, cellKey } from "./engagement-logic";

describe("bonusTotal", () => {
  it("sums achieved-criteria bonuses (cent-rounded)", () => {
    expect(bonusTotal([])).toBe(0);
    expect(bonusTotal([{ bonusAmount: 100 }, { bonusAmount: 250.5 }, { bonusAmount: 0 }])).toBe(350.5);
  });
});

describe("eventTitle", () => {
  it("prefers the override, else falls back to the template name", () => {
    expect(eventTitle({ title: "Q1 Quiz" }, "Quiz")).toBe("Q1 Quiz");
    expect(eventTitle({ title: "  " }, "Quiz")).toBe("Quiz");
    expect(eventTitle({ title: null }, "Quiz")).toBe("Quiz");
  });
});

describe("cellKey", () => {
  it("builds a stable employee:criterion key", () => {
    expect(cellKey(7, 3)).toBe("7:3");
  });
});
