import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth/access";
import { maybeRunScheduledBackup } from "@/lib/backup/backup-service";

/** Constant-time compare (avoids leaking the secret via response timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Off-site backup tick. Drive it on a schedule with an external cron (e.g. every
 * 15 min — the app decides when a backup is actually DUE per its stored schedule):
 *   *​/15 * * * * curl -fsS -H "x-cron-key: $CRON_SECRET" https://in.yeldn.com/api/cron/backup
 * Authorized by a matching `x-cron-key` header against CRON_SECRET, or an admin
 * session (so it can be triggered manually). Header-only — never the query string.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const key = req.headers.get("x-cron-key");
  let authed = !!(secret && key && safeEqual(key, secret));
  if (!authed) authed = (await getAccess()).isAdmin;
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await maybeRunScheduledBackup().catch((e) => ({
    ran: false,
    error: e instanceof Error ? e.message : "error",
  }));
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
