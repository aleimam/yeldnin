import { integrationEnabled } from "@/lib/integration/config";

/**
 * Connection-test probe for the Veeey side (Requests epic Phase D). Returns
 * `{status:"ok"}` when the integration is enabled, else 404 — so Veeey's
 * reachability check both confirms the URL responds and reflects the on/off flag.
 * No auth: it exposes nothing but liveness (all data endpoints are HMAC-gated).
 */
export const runtime = "nodejs";

export async function GET() {
  if (!(await integrationEnabled())) return new Response("not found", { status: 404 });
  return Response.json({ status: "ok" });
}
