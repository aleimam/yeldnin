import { describe, it, expect } from "vitest";
import { validateIssue, validateCompensation, isCompensationType } from "./issues-logic";

describe("validateIssue", () => {
  it("requires a title", () => {
    expect(validateIssue({ title: "" })).toHaveProperty("title");
    expect(validateIssue({ title: "Damaged bottle" })).toEqual({});
  });
});

describe("validateCompensation", () => {
  it("requires a valid type; money needs a positive amount", () => {
    expect(validateCompensation({ type: "NOPE" })).toHaveProperty("type");
    expect(validateCompensation({ type: "MONEY", amountEgp: 0 })).toHaveProperty("amount");
    expect(validateCompensation({ type: "MONEY", amountEgp: 500 })).toEqual({});
    expect(validateCompensation({ type: "PRODUCT" })).toEqual({});
  });
  it("guards the type enum", () => {
    expect(isCompensationType("PRODUCT")).toBe(true);
    expect(isCompensationType("CASH")).toBe(false);
  });
});
