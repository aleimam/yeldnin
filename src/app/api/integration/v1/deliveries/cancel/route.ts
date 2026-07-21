import { integrationEnabled } from "@/lib/integration/config";
import { verifyInbound, checkIdempotency, saveIdempotency } from "@/lib/integration/integration-service";
import { handleDeliveryCancel } from "@/lib/integration/delivery-sync";

/**
 * Veeey → YeldnIN `delivery.cancel` (contract v2 §2.2). The customer cancelled
 * after the delivery existed. Accepted while the delivery is still moving →
 * CANCELLED + the assigned courier is notified. A delivery already DELIVERED or
 * FAILED can't be un-closed → 409 with its current status so Veeey reconciles.
 *
 * Node runtime — Prisma + the node:sqlite adapter can't load on edge.
 */
export const runtime = "nodejs";

const ENDPOINT = "v1.deliveries.cancel";
const err = (code: string, status: number) => Response.json({ error: { code, message: code } }, { status });

export async function POST(req: Request) {
  if (!(await integrationEnabled())) return new Response("not found", { status: 404 });

  const raw = await req.text();
  const url = new URL(req.url);
  const v = await verifyInbound({
    method: "POST",
    path: url.pathname,
    rawBody: raw,
    headers: {
      clientId: req.headers.get("x-client-id"),
      timestamp: req.headers.get("x-timestamp"),
      nonce: req.headers.get("x-nonce"),
      signature: req.headers.get("x-signature"),
    },
    nowMs: Date.now(),
  });
  if (!v.ok) return err(v.code, 401);

  const key = req.headers.get("idempotency-key");
  if (!key) return err("missing_idempotency_key", 400);
  const idem = await checkIdempotency(key, ENDPOINT);
  if (idem.replay) return Response.json(idem.body, { status: idem.statusCode, headers: { "Idempotency-Replayed": "true" } });
  if (idem.reused) return err("idempotency_key_reused", 422);

  let body: unknown;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return err("validation_failed", 422);
  }

  const result = await handleDeliveryCancel(body);

  // 409: already closed the other way. Return the current status + timestamp so
  // Veeey can reconcile rather than silently diverge. NOT saved to the
  // idempotency ledger — a later legitimate retry must see the live state.
  if (!result.ok && result.conflict) {
    return Response.json({ error: { code: "delivery_closed" }, status: result.conflict.status, at: result.conflict.at }, { status: 409 });
  }
  if (!result.ok) {
    const code = result.skipped ?? "validation_failed";
    return err(code, code === "delivery_not_found" ? 404 : 422);
  }

  const response = { ok: true, deliveryUid: result.uid, status: result.status };
  await saveIdempotency(key, ENDPOINT, 200, response);
  return Response.json(response, { status: 200 });
}
