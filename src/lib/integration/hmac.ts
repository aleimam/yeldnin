import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * YeldnIN ↔ Veeey HMAC auth (Requests epic Phase D). Both directions sign the
 * SAME canonical string with a shared secret. This is a byte-for-byte port of
 * Veeey's `src/lib/integration/hmac-logic.ts` — a single differing character
 * would break auth across the wire, so keep the two implementations identical.
 *
 *   canonical = METHOD \n path \n timestamp \n nonce \n sha256hex(rawBody)
 *
 * Pure given its inputs (nonce-replay + the 5-min window are enforced in the
 * service layer). `path` is the request URL's pathname; `rawBody` is the exact
 * bytes sent/received (GET signs over sha256("")).
 */
export const WINDOW_MS = 5 * 60_000;

export function sha256hex(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function canonicalString(method: string, path: string, timestamp: string, nonce: string, rawBody: string): string {
  return [method.toUpperCase(), path, timestamp, nonce, sha256hex(rawBody)].join("\n");
}

export function signRequest(secret: string, method: string, path: string, timestamp: string, nonce: string, rawBody: string): string {
  return createHmac("sha256", secret).update(canonicalString(method, path, timestamp, nonce, rawBody)).digest("hex");
}

export type VerifyCode = "missing_headers" | "timestamp_invalid" | "timestamp_out_of_window" | "bad_signature";
export type VerifyResult = { ok: true } | { ok: false; code: VerifyCode };

export type SignedHeaders = { clientId?: string | null; timestamp?: string | null; nonce?: string | null; signature?: string | null };

export function verifyRequest(opts: {
  secret: string;
  method: string;
  path: string;
  headers: SignedHeaders;
  rawBody: string;
  nowMs: number;
  windowMs?: number;
}): VerifyResult {
  const { clientId, timestamp, nonce, signature } = opts.headers;
  if (!clientId || !timestamp || !nonce || !signature) return { ok: false, code: "missing_headers" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, code: "timestamp_invalid" };
  if (Math.abs(opts.nowMs - ts) > (opts.windowMs ?? WINDOW_MS)) return { ok: false, code: "timestamp_out_of_window" };
  const expected = signRequest(opts.secret, opts.method, opts.path, timestamp, nonce, opts.rawBody);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, code: "bad_signature" };
  return { ok: true };
}
