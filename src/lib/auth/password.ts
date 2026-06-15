import "server-only";
import bcrypt from "bcryptjs";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Password policy: ≥8 chars, with a letter, a digit, and a symbol. */
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw)) return "Password must include a letter.";
  if (!/[0-9]/.test(pw)) return "Password must include a digit.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must include a symbol.";
  return null;
}
