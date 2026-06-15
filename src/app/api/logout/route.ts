import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(req: Request) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
