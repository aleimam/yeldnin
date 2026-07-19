import { describe, it, expect } from "vitest";
import { requestToWire, parseWireRequest } from "./request-wire";

const loaded = {
  uid: "REQ2607014",
  type: "SPECIAL_ORDER",
  status: "PENDING",
  scope: "VEEEY",
  notes: "From order VO-1001",
  deposit: 880, // EGP (YeldnIN stores Float EGP directly — no piastres)
  archivedAt: null,
  customer: { name: "Ada Lovelace", contactNumber: "+20100" },
  lines: [
    { count: 2, sellingPrice: 3500, notes: null, sku: "VIT-D3", productName: "Vitamin D3" },
    { count: 1, sellingPrice: null, notes: "urgent", sku: null, productName: "Mystery" },
  ],
  photoUrls: ["/api/asset/abc"],
};

describe("requestToWire", () => {
  it("legacy wire shim: internal VEEEY scope travels as EGV and parses back to VEEEY", () => {
    const w = requestToWire(loaded);
    expect(w.scope).toBe("EGV"); // contract v1 wire value — old site never sees the rename
    const parsed = parseWireRequest(JSON.parse(JSON.stringify(w)));
    expect(parsed!.scope).toBe("VEEEY"); // internal value on the way back in
    // non-VEEEY scopes pass through untouched
    expect(requestToWire({ ...loaded, scope: "XOONX" }).scope).toBe("XOONX");
  });

  it("maps YeldnIN Float EGP straight onto the wire and flattens the loaded shape", () => {
    const w = requestToWire(loaded);
    expect(w.uid).toBe("REQ2607014");
    expect(w.depositEgp).toBe(880);
    expect(w.customer).toEqual({ name: "Ada Lovelace", phone: "+20100", veeeyCustomerId: null });
    expect(w.veeeyOrderId).toBeNull();
    expect(w.autoOptional).toBe(false);
    expect(w.lines[0]).toEqual({ sku: "VIT-D3", productName: "Vitamin D3", quantity: 2, sellingPriceEgp: 3500, notes: null });
    expect(w.lines[1].sellingPriceEgp).toBeNull();
    expect(w.archived).toBe(false);
  });

  it("emits a null customer + null deposit when absent, and archived=true once archivedAt is set", () => {
    const w = requestToWire({ ...loaded, customer: null, deposit: null, archivedAt: new Date() });
    expect(w.customer).toBeNull();
    expect(w.depositEgp).toBeNull();
    expect(w.archived).toBe(true);
  });
});

describe("parseWireRequest", () => {
  it("round-trips a wire payload produced by requestToWire", () => {
    const w = requestToWire(loaded);
    const parsed = parseWireRequest(JSON.parse(JSON.stringify(w)));
    expect(parsed).not.toBeNull();
    expect(parsed!.uid).toBe("REQ2607014");
    expect(parsed!.type).toBe("SPECIAL_ORDER");
    expect(parsed!.depositEgp).toBe(880);
    expect(parsed!.lines).toHaveLength(2);
    expect(parsed!.lines[0].sellingPriceEgp).toBe(3500);
  });

  it("rejects unknown type, missing uid, or no valid lines", () => {
    expect(parseWireRequest({ uid: "X", type: "BOGUS", lines: [{ sku: "A", quantity: 1, productName: "A" }] })).toBeNull();
    expect(parseWireRequest({ type: "RESTOCK", lines: [{ sku: "A", quantity: 1, productName: "A" }] })).toBeNull();
    expect(parseWireRequest({ uid: "X", type: "RESTOCK", lines: [] })).toBeNull();
    expect(parseWireRequest(null)).toBeNull();
  });

  it("accepts all four types + defaults an unknown status to PENDING", () => {
    for (const t of ["SPECIAL_ORDER", "OUT_OF_STOCK", "RESTOCK", "OPTIONAL"]) {
      const p = parseWireRequest({ uid: "REQ1", type: t, status: "WEIRD", lines: [{ sku: "A", quantity: 3, productName: "A" }] });
      expect(p?.type).toBe(t);
      expect(p?.status).toBe("PENDING");
    }
  });

  it("drops lines with neither sku nor product name but keeps the valid ones", () => {
    const p = parseWireRequest({ uid: "REQ1", type: "RESTOCK", lines: [{ quantity: 1 }, { sku: "A", quantity: 2, productName: "A" }] });
    expect(p?.lines).toHaveLength(1);
    expect(p?.lines[0].quantity).toBe(2);
  });
});
