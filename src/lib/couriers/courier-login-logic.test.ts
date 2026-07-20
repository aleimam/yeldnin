import { describe, it, expect } from "vitest";
import { normalizePhone, isPhoneIdentifier, validatePin, courierEmail, PIN_MIN, PIN_MAX } from "./courier-login-logic";

describe("normalizePhone", () => {
  it("canonicalises the same number typed every way to ONE value", () => {
    const canon = "01001234567";
    expect(normalizePhone("01001234567")).toBe(canon);
    expect(normalizePhone("0100 123 4567")).toBe(canon);
    expect(normalizePhone("+201001234567")).toBe(canon);
    expect(normalizePhone("+20 100 123 4567")).toBe(canon);
    expect(normalizePhone("00201001234567")).toBe(canon);
    expect(normalizePhone("(0100) 123-4567")).toBe(canon);
  });

  it("accepts all four Egyptian mobile prefixes", () => {
    for (const p of ["010", "011", "012", "015"]) {
      expect(normalizePhone(`${p}01234567`)).toBe(`${p}01234567`);
    }
  });

  it("rejects things that aren't Egyptian mobiles", () => {
    expect(normalizePhone("013 01234567")).toBeNull(); // no 013 prefix
    expect(normalizePhone("0100123456")).toBeNull(); // 10 digits, too short
    expect(normalizePhone("010012345678")).toBeNull(); // 12 digits, too long
    expect(normalizePhone("admin@yeldn.local")).toBeNull(); // an email
    expect(normalizePhone("mahmoud")).toBeNull(); // a plain username
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("isPhoneIdentifier mirrors normalizePhone", () => {
    expect(isPhoneIdentifier("01001234567")).toBe(true);
    expect(isPhoneIdentifier("admin@yeldn.local")).toBe(false);
  });
});

describe("validatePin", () => {
  it("accepts a 4–6 digit non-trivial PIN", () => {
    expect(validatePin("8305")).toBeNull();
    expect(validatePin("620194")).toBeNull();
    expect(PIN_MIN).toBe(4);
    expect(PIN_MAX).toBe(6);
  });

  it("requires digits only", () => {
    expect(validatePin("12a4")).toContain("digits");
    expect(validatePin("abcd")).toContain("digits");
  });

  it("enforces length", () => {
    expect(validatePin("123")).toContain("4");
    expect(validatePin("1234567")).toContain("6");
  });

  it("rejects all-same and simple sequences — the first PINs an attacker tries", () => {
    expect(validatePin("1111")).toContain("same");
    expect(validatePin("000000")).toContain("same");
    expect(validatePin("1234")).toContain("sequence");
    expect(validatePin("123456")).toContain("sequence");
    expect(validatePin("4321")).toContain("sequence");
    expect(validatePin("654321")).toContain("sequence");
    expect(validatePin("0123")).toContain("sequence");
    // a near-sequence with one break is fine
    expect(validatePin("1235")).toBeNull();
  });
});

describe("courierEmail", () => {
  it("mints a unique, unreachable internal address (RFC 2606 .invalid)", () => {
    expect(courierEmail("01001234567")).toBe("courier.01001234567@yeldn.invalid");
    // distinct phones never collide on the unique email column
    expect(courierEmail("01001234567")).not.toBe(courierEmail("01001234568"));
  });
});
