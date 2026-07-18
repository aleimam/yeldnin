import { describe, expect, it } from "vitest";
import { canonicalString, sha256hex, signRequest, verifyRequest } from "./hmac";

const secret = "a-shared-secret-at-least-32-chars-long!";
const now = 1_700_000_000_000;
const base = { secret, method: "POST", path: "/api/integration/v1/requests", timestamp: String(now), nonce: "nonce-1", rawBody: '{"uid":"REQ2607014"}' };

describe("integration HMAC (shared Veeey contract)", () => {
  it("canonical string is 5 newline-joined parts ending in the body hash", () => {
    const c = canonicalString("post", "/p", "123", "n", "body");
    expect(c.split("\n")).toEqual(["POST", "/p", "123", "n", sha256hex("body")]);
  });

  // Known-answer vector — the signature is computed once and hard-coded here so a
  // drift in the canonical form (which would silently break auth with Veeey) fails
  // this test. If Veeey's hmac-logic.ts is ever changed, both must move together.
  it("matches the pinned known-answer vector (must byte-match Veeey)", () => {
    expect(sha256hex(base.rawBody)).toBe("65ade7591038a601857979383ffacb4641f176e69b9451f94e2f83364a65a18a");
    const sig = signRequest(base.secret, base.method, base.path, base.timestamp, base.nonce, base.rawBody);
    expect(sig).toBe("e04b2de926486949fe63a9b8617c7408bcc7f8dc212d60cbc354665ea43dbe89");
  });

  it("a freshly signed request verifies", () => {
    const sig = signRequest(base.secret, base.method, base.path, base.timestamp, base.nonce, base.rawBody);
    const r = verifyRequest({ ...base, headers: { clientId: "veeey", timestamp: base.timestamp, nonce: base.nonce, signature: sig }, nowMs: now });
    expect(r).toEqual({ ok: true });
  });

  it("GET (empty body) signs over sha256(\"\")", () => {
    const sig = signRequest(secret, "GET", "/api/integration/v1/health", String(now), "n2", "");
    const r = verifyRequest({ secret, method: "GET", path: "/api/integration/v1/health", rawBody: "", headers: { clientId: "veeey", timestamp: String(now), nonce: "n2", signature: sig }, nowMs: now });
    expect(r.ok).toBe(true);
  });

  it("rejects missing headers, out-of-window, tampered body, and wrong secret", () => {
    const sig = signRequest(base.secret, base.method, base.path, base.timestamp, base.nonce, base.rawBody);
    const hdr = { clientId: "veeey", timestamp: base.timestamp, nonce: base.nonce, signature: sig };
    expect(verifyRequest({ ...base, headers: { ...hdr, signature: null }, nowMs: now })).toEqual({ ok: false, code: "missing_headers" });
    expect(verifyRequest({ ...base, headers: hdr, nowMs: now + 6 * 60_000 })).toEqual({ ok: false, code: "timestamp_out_of_window" });
    expect(verifyRequest({ ...base, rawBody: '{"uid":"X"}', headers: hdr, nowMs: now })).toEqual({ ok: false, code: "bad_signature" });
    expect(verifyRequest({ ...base, secret: "wrong", headers: hdr, nowMs: now })).toEqual({ ok: false, code: "bad_signature" });
  });
});
