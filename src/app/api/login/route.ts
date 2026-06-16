import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";

// A real bcrypt hash to compare against when the email is unknown, so the
// response time doesn't reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Very small in-memory rate limiter (single PM2 fork process). Per IP.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
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

// Relative 303 redirect — never build an absolute URL from req.url behind nginx
// (it would resolve to the internal host, sending the browser to localhost).
const seeOther = (path: string) =>
  new NextResponse(null, { status: 303, headers: { Location: path } });

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return seeOther("/login?error=1");
  }

  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const fail = () => seeOther("/login?error=1");

  if (!email || !password) return fail();

  const user = await prisma.user.findUnique({ where: { email } });
  // Always run a comparison (constant-ish time) even when the user is missing.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || user.archivedAt || !ok) return fail();

  await setSessionCookie(user.id);
  return seeOther("/");
}
