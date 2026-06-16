import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  // Relative redirect (nginx-safe; absolute URLs from req.url hit the internal host).
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}
