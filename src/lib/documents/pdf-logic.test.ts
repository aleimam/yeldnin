import { describe, it, expect } from "vitest";
import { mmToPt, sanitizeMarginMm, contentBox, wrapWords, equalColumns, lineHeight } from "./pdf-logic";

describe("mmToPt", () => {
  it("converts mm to points (25.4mm = 1in = 72pt)", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 5);
    expect(mmToPt(0)).toBe(0);
    expect(mmToPt(10)).toBeCloseTo(28.3464, 3);
  });
});

describe("sanitizeMarginMm", () => {
  it("keeps valid non-negative integers, rounds, clamps, falls back", () => {
    expect(sanitizeMarginMm(20, 45)).toBe(20);
    expect(sanitizeMarginMm("30", 45)).toBe(30);
    expect(sanitizeMarginMm(12.6, 45)).toBe(13);
    expect(sanitizeMarginMm(-5, 45)).toBe(45);
    expect(sanitizeMarginMm("abc", 45)).toBe(45);
    expect(sanitizeMarginMm(500, 45)).toBe(120);
  });
});

describe("contentBox", () => {
  it("computes the drawable region in PDF (bottom-left origin) coords", () => {
    // A4 = 595.28 x 841.89 pt; margins all 0 → full page
    const full = contentBox(595.28, 841.89, { top: 0, bottom: 0, left: 0, right: 0 });
    expect(full.left).toBe(0);
    expect(full.right).toBeCloseTo(595.28, 2);
    expect(full.top).toBeCloseTo(841.89, 2);
    expect(full.bottom).toBe(0);
    expect(full.width).toBeCloseTo(595.28, 2);

    const box = contentBox(595.28, 841.89, { top: 45, bottom: 30, left: 22, right: 22 });
    expect(box.left).toBeCloseTo(mmToPt(22), 4);
    expect(box.right).toBeCloseTo(595.28 - mmToPt(22), 4);
    expect(box.top).toBeCloseTo(841.89 - mmToPt(45), 4);
    expect(box.bottom).toBeCloseTo(mmToPt(30), 4);
    expect(box.width).toBeCloseTo(595.28 - mmToPt(44), 4);
  });
});

describe("wrapWords", () => {
  const W = (text: string, width: number) => ({ text, width });
  it("wraps greedily and never splits a word", () => {
    const words = [W("aaa", 30), W("bbb", 30), W("ccc", 30)];
    // maxWidth 70, space 10: "aaa bbb" = 30+10+30=70 fits; +ccc would be 110 → wrap
    const lines = wrapWords(words, 70, 10);
    expect(lines.map((l) => l.map((w) => w.text).join(" "))).toEqual(["aaa bbb", "ccc"]);
  });
  it("an over-wide word gets its own line", () => {
    const lines = wrapWords([W("tiny", 10), W("HUGEWORD", 200)], 50, 5);
    expect(lines.map((l) => l.length)).toEqual([1, 1]);
    expect(lines[1][0].text).toBe("HUGEWORD");
  });
  it("empty input returns no lines", () => {
    expect(wrapWords([], 100, 5)).toEqual([]);
  });
});

describe("equalColumns", () => {
  it("splits usable width evenly", () => {
    expect(equalColumns(300, 3)).toEqual([100, 100, 100]);
    expect(equalColumns(300, 0)).toEqual([]);
  });
});

describe("lineHeight", () => {
  it("scales with size", () => {
    expect(lineHeight(10)).toBeCloseTo(13.4, 5);
    expect(lineHeight(10, 1.5)).toBe(15);
  });
});
