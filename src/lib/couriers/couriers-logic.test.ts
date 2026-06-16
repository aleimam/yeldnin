import { describe, it, expect } from "vitest";
import { validateCourier } from "./couriers-logic";

describe("validateCourier", () => {
  it("requires a name", () => {
    expect(validateCourier({ name: "" })).toHaveProperty("name");
    expect(validateCourier({ name: "Aramex" })).toEqual({});
  });
});
