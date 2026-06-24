import { NextResponse } from "next/server";
import { getAccess } from "@/lib/auth/access";
import { logError } from "@/lib/errors/error-log-service";

/** Receives client-side errors (window.onerror / unhandledrejection / boundaries)
 *  and records them. Authenticated internal users only; always 204 so the client
 *  reporter never has to handle a failure. */
export async function POST(req: Request) {
  try {
    const access = await getAccess();
    if (access.user) {
      const body = (await req.json().catch(() => ({}))) as {
        message?: string;
        stack?: string;
        url?: string;
        source?: string;
      };
      await logError({
        level: "error",
        source: body.source === "boundary" ? "client:boundary" : "client",
        message: body.message ? String(body.message) : "(client error)",
        stack: body.stack ? String(body.stack) : null,
        url: body.url ? String(body.url) : null,
        userId: access.user.id,
      });
    }
  } catch {
    // never surface logging failures to the client
  }
  return new NextResponse(null, { status: 204 });
}
