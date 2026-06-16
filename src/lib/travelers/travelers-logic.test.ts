import { describe, it, expect } from "vitest";
import { parseTypes, joinTypes, validateTraveler } from "./travelers-logic";
import { validateCustomer, isContactChannel } from "@/lib/customers/customers-logic";
import { validateHub, isCountry } from "@/lib/hubs/hubs-logic";

describe("traveler allowedProductTypes CSV", () => {
  it("round-trips valid types and drops junk", () => {
    expect(parseTypes("SUPPLEMENT,DEVICE")).toEqual(["SUPPLEMENT", "DEVICE"]);
    expect(parseTypes("SUPPLEMENT, BOGUS , INJECTION")).toEqual(["SUPPLEMENT", "INJECTION"]);
    expect(parseTypes("")).toEqual([]);
    expect(joinTypes(["DEVICE", "NOPE", "XOONX"])).toBe("DEVICE,XOONX");
  });
});

describe("validators", () => {
  it("traveler requires a name", () => {
    expect(validateTraveler({ name: "" })).toHaveProperty("name");
    expect(validateTraveler({ name: "Sam" })).toEqual({});
  });
  it("customer requires a name; contact channel guard", () => {
    expect(validateCustomer({ name: "" })).toHaveProperty("name");
    expect(validateCustomer({ name: "Ada" })).toEqual({});
    expect(isContactChannel("WHATSAPP")).toBe(true);
    expect(isContactChannel("SIGNAL")).toBe(false);
  });
  it("hub requires name + valid country", () => {
    expect(validateHub({ name: "", country: "USA" })).toHaveProperty("name");
    expect(validateHub({ name: "LA", country: "MARS" })).toHaveProperty("country");
    expect(validateHub({ name: "LA", country: "USA" })).toEqual({});
    expect(isCountry("UK")).toBe(true);
  });
});
