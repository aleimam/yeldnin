import { describe, it, expect } from "vitest";
import { isCountry, validateHub } from "./hubs-logic";

describe("isCountry", () => {
  it("accepts the allowed countries, rejects anything else", () => {
    expect(isCountry("USA")).toBe(true);
    expect(isCountry("UK")).toBe(true);
    expect(isCountry("EU")).toBe(true);
    expect(isCountry("EGYPT")).toBe(false);
    expect(isCountry("")).toBe(false);
    expect(isCountry(123)).toBe(false);
    expect(isCountry(null)).toBe(false);
  });
});

describe("validateHub", () => {
  it("passes a well-formed hub", () => {
    expect(validateHub({ name: "Cairo Hub", country: "EU" })).toEqual({});
  });
  it("requires a name", () => {
    expect(validateHub({ name: "  ", country: "USA" }).name).toBeTruthy();
  });
  it("requires a valid country", () => {
    expect(validateHub({ name: "Hub", country: "MARS" }).country).toBeTruthy();
    expect(validateHub({ name: "Hub" }).country).toBeTruthy();
  });
  it("reports both errors at once", () => {
    const e = validateHub({});
    expect(e.name).toBeTruthy();
    expect(e.country).toBeTruthy();
  });
});
