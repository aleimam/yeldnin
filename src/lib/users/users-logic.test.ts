import { describe, it, expect } from "vitest";
import { displayName } from "./users-logic";

describe("displayName", () => {
  it("uses the base name in English", () => {
    expect(displayName({ name: "Sara", nameAr: "سارة" }, "en")).toBe("Sara");
  });
  it("uses the Arabic name in Arabic when present", () => {
    expect(displayName({ name: "Sara", nameAr: "سارة" }, "ar")).toBe("سارة");
  });
  it("falls back to the base name when the Arabic one is blank/missing", () => {
    expect(displayName({ name: "Sara", nameAr: "" }, "ar")).toBe("Sara");
    expect(displayName({ name: "Sara", nameAr: null }, "ar")).toBe("Sara");
    expect(displayName({ name: "Sara" }, "ar")).toBe("Sara");
  });
});
