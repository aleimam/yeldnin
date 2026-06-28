import { describe, it, expect } from "vitest";
import { isValidBaseUrl, keyHint, INBOUND_KEY_PREFIX } from "./integrations-logic";

describe("isValidBaseUrl", () => {
  it("accepts http(s) URLs and rejects everything else", () => {
    expect(isValidBaseUrl("https://api.veeey.com")).toBe(true);
    expect(isValidBaseUrl("http://localhost:3000/api")).toBe(true);
    expect(isValidBaseUrl("  https://api.veeey.com/v1  ")).toBe(true); // trimmed
    expect(isValidBaseUrl("")).toBe(false);
    expect(isValidBaseUrl("ftp://x.com")).toBe(false);
    expect(isValidBaseUrl("api.veeey.com")).toBe(false); // no scheme
    expect(isValidBaseUrl("not a url")).toBe(false);
  });
});

describe("keyHint", () => {
  it("shows the prefix and a few chars, hiding the rest", () => {
    const key = `${INBOUND_KEY_PREFIX}abcd1234567890`;
    const hint = keyHint(key);
    expect(hint).toBe("veeey_abcd…");
    expect(hint).not.toContain("567890"); // the bulk of the key never appears
  });
});
