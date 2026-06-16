import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth/access";
import { advanceDueItems } from "@/lib/items/items-service";

/**
 * Auto-advance sweep (HUB→Transit→Global Shipping). Drive it on a schedule with
 * an external cron, e.g. every 10 min:
 *   *​/10 * * * * curl -fsS -H "x-cron-key: $CRON_SECRET" https://in.yeldn.com/api/cron/advance
 * Authorized by a matching `x-cron-key` header against CRON_SECRET, or an admin
 * session (so it can be triggered manually from the app).
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const key = req.headers.get("x-cron-key") ?? new URL(req.url).searchParams.get("key");
  let authed = !!(secret && key && key === secret);
  if (!authed) {
    const access = await getAccess();
    authed = access.isAdmin;
  }
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const advanced = await advanceDueItems();
  return NextResponse.json({ advanced });
}

export const GET = handle;
export const POST = handle;
