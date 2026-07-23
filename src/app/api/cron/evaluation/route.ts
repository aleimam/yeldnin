import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth/access";
import { runCycleReminders } from "@/lib/evaluation/eval-notify-service";

/** Constant-time compare (no secret leak via response timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Daily 360 Reviews sweep: reminder cadence to still-incomplete participants of
 * the open cycle + a one-time "fully complete" note to admins. Run once a day:
 *   0 9 * * * curl -fsS -H "x-cron-key: $CRON_SECRET" https://in.yeldn.com/api/cron/evaluation
 * Authorized by `x-cron-key` against CRON_SECRET (header-only), or an admin
 * session so it can be triggered manually from the app. Self-dedups per day.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const key = req.headers.get("x-cron-key");
  let authed = !!(secret && key && safeEqual(key, secret));
  if (!authed) authed = (await getAccess()).isAdmin;
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await runCycleReminders();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
