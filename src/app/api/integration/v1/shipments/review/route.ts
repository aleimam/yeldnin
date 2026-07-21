import { integrationEnabled } from "@/lib/integration/config";
import { verifyInbound, checkIdempotency, saveIdempotency } from "@/lib/integration/integration-service";
import { handleShipmentReview } from "@/lib/integration/shipment-sync";

/**
 * Veeey → YeldnIN `shipment.review` — Sales' verdict on a stock-in.
 *
 * REJECTED reopens the shipment (and its units) at PHOTOS_SENT with the reason
 * attached, so Ops can correct the expiry/photos and mark it In Website again.
 * APPROVED is recorded for visibility only.
 *
 * 404 while the integration is off; otherwise HMAC-verified, nonce-replay
 * protected, and idempotent by Idempotency-Key.
 *
 * Node runtime — Prisma + the node:sqlite adapter can't load on edge.
 */
export const runtime = "nodejs";

const ENDPOINT = "v1.shipments.review";
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
  if (idem.replay) return Response.json(idem.body, { status: idem.statusCode });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return err("invalid_json", 400);
  }

  const result = await handleShipmentReview(payload);
  const status = result.ok ? 200 : 422;
  await saveIdempotency(key, ENDPOINT, status, result);
  return Response.json(result, { status });
}
