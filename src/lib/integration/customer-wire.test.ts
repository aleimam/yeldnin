import { describe, it, expect } from "vitest";
import { parseWireCustomer } from "./customer-wire";

describe("parseWireCustomer", () => {
  it("accepts a valid registered customer and lowercases the email", () => {
    expect(parseWireCustomer({ veeeyCustomerId: "VC-123", name: "Ali Hassan", email: "Ali@Example.COM", phone: "+20100", archived: false })).toEqual({
      veeeyCustomerId: "VC-123",
      name: "Ali Hassan",
      email: "ali@example.com",
      phone: "+20100",
      archived: false,
    });
  });
  it("email + phone optional; archived defaults false", () => {
    expect(parseWireCustomer({ veeeyCustomerId: "VC-1", name: "Ada" })).toEqual({ veeeyCustomerId: "VC-1", name: "Ada", email: null, phone: null, archived: false });
  });
  it("rejects a missing id or name (never a guest with no key)", () => {
    expect(parseWireCustomer({ name: "Ada" })).toBeNull();
    expect(parseWireCustomer({ veeeyCustomerId: "VC-1" })).toBeNull();
    expect(parseWireCustomer({ veeeyCustomerId: "  ", name: "Ada" })).toBeNull();
    expect(parseWireCustomer(null)).toBeNull();
  });
});
