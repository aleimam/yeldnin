import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";

// Native login route (not a server action) so password managers offer to save.
// Emits RELATIVE redirects so it works behind nginx (never absolute from Host).
export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const fail = () =>
    NextResponse.redirect(new URL("/login?error=1", req.url), { status: 303 });

  if (!email || !password) return fail();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || user.archivedAt) return fail();

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return fail();

  await setSessionCookie(user.id);
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
