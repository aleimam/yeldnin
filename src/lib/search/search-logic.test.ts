import { describe, it, expect } from "vitest";
import { parseQuery, isSearchable, uidPrefix, UID_PREFIX_TYPE } from "./search-logic";

describe("parseQuery", () => {
  it("detects a UID and upper-cases it", () => {
    const p = parseQuery("  itm2606001 ");
    expect(p.kind).toBe("uid");
    expect(p.uid).toBe("ITM2606001");
    expect(p.text).toBe("itm2606001");
  });

  it("treats a plain name as text", () => {
    const p = parseQuery("vitamin c");
    expect(p.kind).toBe("text");
    expect(p.uid).toBeNull();
  });

  it("does not mistake a short word for a UID", () => {
    expect(parseQuery("ab12").kind).toBe("text"); // only 2 digits
    expect(parseQuery("hub").kind).toBe("text"); // no digits
  });
});

describe("isSearchable", () => {
  it("requires at least 2 non-space chars", () => {
    expect(isSearchable("a")).toBe(false);
    expect(isSearchable("  ")).toBe(false);
    expect(isSearchable("ab")).toBe(true);
  });
});

describe("uidPrefix", () => {
  it("extracts the letter prefix and maps to a type", () => {
    expect(uidPrefix("ISS2606003")).toBe("ISS");
    expect(UID_PREFIX_TYPE[uidPrefix("ITM2606001")!]).toBe("item");
  });
  it("returns null when there's no prefix", () => {
    expect(uidPrefix("2606001")).toBeNull();
  });
});
