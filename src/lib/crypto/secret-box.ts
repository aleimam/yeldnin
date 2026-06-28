import "server-only";
import crypto from "node:crypto";

// Symmetric encryption for secrets we must store but be able to read back (e.g.
// an outbound API key we send to a third party). AES-256-GCM with a key derived
// from SESSION_SECRET via HKDF, so no extra env var is needed — but rotating
// SESSION_SECRET invalidates anything encrypted here (the user just re-enters it).
// Output format: "v1:" + base64url(iv | authTag | ciphertext).

const DEV_SECRET = "dev-only-change-me-in-env-local";

function key(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s === DEV_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set to a strong random value in production.");
    }
    return Buffer.from(crypto.hkdfSync("sha256", DEV_SECRET, "yeldnin-secretbox", "v1", 32));
  }
  return Buffer.from(crypto.hkdfSync("sha256", s, "yeldnin-secretbox", "v1", 32));
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${Buffer.concat([iv, tag, enc]).toString("base64url")}`;
}

/** Decrypt a value produced by {@link encryptSecret}. Returns null if it can't be
 *  read (wrong/rotated key, corrupt value) rather than throwing. */
export function decryptSecret(token: string | null | undefined): string | null {
  if (!token || !token.startsWith("v1:")) return null;
  try {
    const raw = Buffer.from(token.slice(3), "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
