import { integrationEnabled } from "@/lib/integration/config";
import { verifyInbound, checkIdempotency, saveIdempotency } from "@/lib/integration/integration-service";
import { handleCustomerUpsert } from "@/lib/integration/customer-sync";

/**
 * Veeey → YeldnIN customer upsert (contract v2 §2). Registered customers only.
 * 404 while off; HMAC-verified, nonce-replay-protected, idempotent. Structure
 * mirrors /products/upsert. Node runtime (Prisma + node:sqlite).
 */
export const runtime = "nodejs";

const ENDPOINT = "v1.customers.upsert";
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

  const result = await handleCustomerUpsert(body);
  if (!result.ok) return err(result.skipped ?? "validation_failed", 422);

  const response = { ok: true, customerId: result.customerId, created: !!result.created };
  await saveIdempotency(key, ENDPOINT, 200, response);
  return Response.json(response, { status: 200 });
}
