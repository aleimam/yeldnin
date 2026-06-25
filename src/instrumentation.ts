// Next.js instrumentation: capture every server-side error (RSC renders, route
// handlers, server actions) into the Error Log. Best-effort; never re-throws.

/** Skip benign, high-volume noise: stale-client / cached-PWA hits replaying old
 *  server actions, and Next's internal control-flow "errors" (redirect/notFound).
 *  Logging these would flood the Error Log and add needless DB writes per hit. */
function isBenignError(err: unknown): boolean {
  const e = err as { message?: unknown; digest?: unknown } | null;
  const msg = typeof e?.message === "string" ? e.message : "";
  const digest = typeof e?.digest === "string" ? e.digest : "";
  return (
    msg.includes("Failed to find Server Action") ||
    digest.startsWith("NEXT_REDIRECT") ||
    digest === "NEXT_NOT_FOUND" ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
  );
}

export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string },
): Promise<void> {
  try {
    // Only the Node runtime can reach the DB (the edge runtime can't load the adapter).
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    if (isBenignError(err)) return;
    const { logError } = await import("@/lib/errors/error-log-service");
    const e = err as { message?: unknown; stack?: unknown } | null;
    await logError({
      level: "error",
      source: context?.routeType ? `server:${context.routeType}` : "server",
      message: e?.message ? String(e.message) : String(err),
      stack: e?.stack ? String(e.stack) : null,
      url: request?.path ?? context?.routePath ?? null,
      method: request?.method ?? null,
      meta: { routerKind: context?.routerKind, routePath: context?.routePath, routeType: context?.routeType },
    });
  } catch {
    // logging must never break a request
  }
}
