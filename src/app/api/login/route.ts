import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";

// A real bcrypt hash to compare against when the email is unknown, so the
// response time doesn't reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

// In-memory IP throttle (first layer; per PM2 fork). The durable per-account
// lockout below survives restarts and is the real defence against credential
// stuffing on a specific account.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const LOCK_THRESHOLD = 10; // consecutive account failures before a temporary lock
const LOCK_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count++;
  return rec.count > MAX_ATTEMPTS;
}

// Behind nginx, x-real-ip is the real client; the LAST x-forwarded-for hop is too.
// The FIRST x-forwarded-for entry is client-supplied (spoofable) — never trust it.
function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",").pop()?.trim() || "unknown";
}

// Relative 303 redirect — never build an absolute URL from req.url behind nginx
// (it would resolve to the internal host, sending the browser to localhost).
const seeOther = (path: string) =>
  new NextResponse(null, { status: 303, headers: { Location: path } });

export async function POST(req: Request) {
  if (rateLimited(clientIp(req))) return seeOther("/login?error=1");

  const form = await req.formData();
  // Accept either an email or a username in the same box ("identifier").
  // Fall back to the legacy "email" field name for older cached pages.
  const identifier = String(form.get("identifier") ?? form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const fail = () => seeOther("/login?error=1");
  if (!identifier || !password) return fail();

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier.toLowerCase() }, { username: identifier }] },
  });

  // Temporarily locked after too many failures — fail generically (don't reveal
  // the account exists; the lock auto-expires).
  if (user?.lockedUntil && user.lockedUntil > new Date()) return fail();

  // Always run a comparison (constant-ish time) even when the user is missing.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || user.archivedAt || !ok) {
    if (user) {
      const failed = user.failedLogins + 1;
      await prisma.user.update({
        where: { id: user.id },
        data:
          failed >= LOCK_THRESHOLD
            ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
            : { failedLogins: failed },
      });
    }
    return fail();
  }

  // Success: clear the failure counters, then issue a token stamped with the
  // user's current tokenVersion (revocation check on every request).
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await setSessionCookie(user.id, user.tokenVersion);
  return seeOther("/");
}
