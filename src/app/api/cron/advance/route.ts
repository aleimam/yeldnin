import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth/access";
import { advanceDueItems } from "@/lib/items/items-service";
import { runSlaAlerts } from "@/lib/sla/sla-service";
import { pruneOldErrorLogs } from "@/lib/errors/error-log-service";

/** Constant-time string compare (avoids leaking the secret via response timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Auto-advance sweep (HUB→Transit→Global Shipping). Drive it on a schedule with
 * an external cron, e.g. every 10 min:
 *   *​/10 * * * * curl -fsS -H "x-cron-key: $CRON_SECRET" https://in.yeldn.com/api/cron/advance
 * Authorized by a matching `x-cron-key` header against CRON_SECRET, or an admin
 * session (so it can be triggered manually from the app). Header-only — the secret
 * is never read from the query string (which would leak it into access logs).
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const key = req.headers.get("x-cron-key");
  let authed = !!(secret && key && safeEqual(key, secret));
  if (!authed) {
    const access = await getAccess();
    authed = access.isAdmin;
  }
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const advanced = await advanceDueItems();
  const slaAlerts = await runSlaAlerts();
  const errorLogsPruned = await pruneOldErrorLogs().catch(() => 0); // 30-day retention
  return NextResponse.json({ advanced, slaAlerts, errorLogsPruned });
}

export const GET = handle;
export const POST = handle;
