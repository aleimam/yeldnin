import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "yeldnin_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const DEV_SECRET = "dev-only-change-me-in-env-local";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s === DEV_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET must be set to a strong random value in production.",
      );
    }
    return DEV_SECRET;
  }
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export interface Session {
  uid: number;
  /** User.tokenVersion at issue time — must still match to be valid (revocation). */
  tv: number;
}

/** Create a signed token: base64url(json).hmac */
export function createToken(userId: number, tokenVersion: number): string {
  const body = b64url(JSON.stringify({ uid: userId, tv: tokenVersion, iat: Date.now() }));
  return `${body}.${sign(body)}`;
}

/** Verify a token and return its session payload, or null if invalid/tampered. */
export function readToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  // constant-time compare
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof parsed.uid !== "number") return null;
    // Reject tokens older than MAX_AGE (server-side expiry, not just cookie life).
    if (typeof parsed.iat === "number" && Date.now() - parsed.iat > MAX_AGE * 1000) {
      return null;
    }
    // Pre-revocation tokens have no `tv`; treat as version 0 (matches the default).
    return { uid: parsed.uid, tv: typeof parsed.tv === "number" ? parsed.tv : 0 };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: number, tokenVersion: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, createToken(userId, tokenVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return readToken(store.get(COOKIE)?.value);
}
