import { integrationEnabled } from "@/lib/integration/config";
import { verifyInbound, checkIdempotency, saveIdempotency } from "@/lib/integration/integration-service";
import { handleDeliveryCreated } from "@/lib/integration/delivery-sync";

/**
 * Veeey → YeldnIN `delivery.created` (contract v2 §2.1). Fired when Veeey Ops
 * mark an order shipped via VEEEY Express. 404 while the integration is off;
 * otherwise HMAC-verified, nonce-replay-protected, and idempotent BOTH by
 * `Idempotency-Key` (exact retry) and by (storeKey, orderNumber) in the handler
 * (a re-fired create returns the existing delivery, never a duplicate).
 *
 * Node runtime — Prisma + the node:sqlite adapter can't load on edge.
 */
export const runtime = "nodejs";

const ENDPOINT = "v1.deliveries.created";
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

  const result = await handleDeliveryCreated(body);
  if (!result.ok) return err(result.skipped ?? "validation_failed", 422);

  const response = { ok: true, deliveryUid: result.uid, status: result.status, created: !!result.created };
  await saveIdempotency(key, ENDPOINT, 200, response);
  return Response.json(response, { status: 200 });
}
