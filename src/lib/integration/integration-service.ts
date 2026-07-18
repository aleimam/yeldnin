import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { signRequest, verifyRequest } from "@/lib/integration/hmac";
import {
  integrationConfig,
  integrationEnabled,
  veeeySecret,
  veeeyWebhookTarget,
  YELDNIN_CLIENT_ID,
  BACKOFF_MS,
} from "@/lib/integration/config";

/**
 * Outbox + inbound plumbing for the YeldnIN ↔ Veeey request sync (Requests epic
 * Phase D). Mirrors Veeey's `integration-service.ts` semantics. Everything is
 * gated on the integration flag; on SQLite the JSON columns are String, so we
 * JSON.stringify going in and JSON.parse coming out.
 */

// ── Outbound (YeldnIN → Veeey webhook) ─────────────────────────────────────

/** Record a domain event for outbound delivery. No-op when the flag is off (so a
 *  disabled integration never accumulates a stale backlog). `payload` is the wire
 *  object; it is stored as a JSON string (SQLite has no Json column). */
export async function recordOutbox(type: string, aggregateId: string | null, payload: unknown) {
  if (!(await integrationEnabled())) return null;
  return prisma.outboxEvent.create({ data: { type, aggregateId, payloadJson: JSON.stringify(payload) } });
}

function backoff(attempts: number): { status: "FAILED" | "DEAD"; nextAttemptAt: Date | null } {
  if (attempts >= BACKOFF_MS.length) return { status: "DEAD", nextAttemptAt: null };
  return { status: "FAILED", nextAttemptAt: new Date(Date.now() + BACKOFF_MS[attempts]) };
}

/**
 * Sign + POST due outbox events to Veeey's webhook. No-op when the flag/secret/
 * baseUrl is absent. Each event is delivered as the shared envelope
 * `{ id, type, occurredAt, payload:<wire> }`, HMAC-signed over the target's
 * pathname, with the outbox id as the Idempotency-Key (so Veeey de-dupes retries).
 */
export async function dispatchOutbox(limit = 20): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const cfg = await integrationConfig();
  const target = veeeyWebhookTarget(cfg.baseUrl);
  if (!cfg.enabled || !cfg.secret || !target) return { sent: 0, failed: 0, skipped: true };
  const secret = cfg.secret;

  const now = new Date();
  const events = await prisma.outboxEvent.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const ev of events) {
    let wire: unknown;
    try {
      wire = JSON.parse(ev.payloadJson);
    } catch {
      await prisma.outboxEvent.update({ where: { id: ev.id }, data: { status: "DEAD", lastError: "bad_payload_json" } });
      failed += 1;
      continue;
    }
    const body = JSON.stringify({ id: ev.id, type: ev.type, occurredAt: new Date().toISOString(), payload: wire });
    const ts = String(Date.now());
    const nonce = randomUUID();
    const sig = signRequest(secret, "POST", target.path, ts, nonce, body);
    try {
      const res = await fetch(target.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Client-Id": YELDNIN_CLIENT_ID,
          "X-Timestamp": ts,
          "X-Nonce": nonce,
          "X-Signature": sig,
          "Idempotency-Key": ev.id,
        },
        body,
      });
      if (res.ok) {
        await prisma.outboxEvent.update({ where: { id: ev.id }, data: { status: "SENT", sentAt: new Date(), attempts: ev.attempts + 1, lastError: null } });
        sent += 1;
      } else {
        await prisma.outboxEvent.update({ where: { id: ev.id }, data: { ...backoff(ev.attempts + 1), attempts: ev.attempts + 1, lastError: `http_${res.status}` } });
        failed += 1;
      }
    } catch (e) {
      await prisma.outboxEvent.update({ where: { id: ev.id }, data: { ...backoff(ev.attempts + 1), attempts: ev.attempts + 1, lastError: e instanceof Error ? e.message.slice(0, 100) : "error" } });
      failed += 1;
    }
  }
  return { sent, failed, skipped: false };
}

// ── Inbound (Veeey → YeldnIN) ──────────────────────────────────────────────

/** Insert the nonce; false if this (nonce, clientId) already existed (replay). */
async function recordNonceOnce(nonce: string, clientId: string): Promise<boolean> {
  try {
    await prisma.integrationNonce.create({ data: { nonce, clientId } });
    return true;
  } catch {
    return false;
  }
}

export type InboundResult = { ok: true } | { ok: false; code: string };

/** HMAC-verify an inbound request (against the shared secret) then burn its nonce.
 *  `path` must be the request URL's pathname. Returns a failure code otherwise. */
export async function verifyInbound(opts: {
  method: string;
  path: string;
  rawBody: string;
  headers: { clientId?: string | null; timestamp?: string | null; nonce?: string | null; signature?: string | null };
  nowMs: number;
}): Promise<InboundResult> {
  const secret = await veeeySecret();
  if (!secret) return { ok: false, code: "integration_disabled" };
  const r = verifyRequest({ secret, method: opts.method, path: opts.path, headers: opts.headers, rawBody: opts.rawBody, nowMs: opts.nowMs });
  if (!r.ok) return { ok: false, code: r.code };
  if (!(await recordNonceOnce(opts.headers.nonce!, opts.headers.clientId ?? "unknown"))) return { ok: false, code: "nonce_replayed" };
  return { ok: true };
}

// ── Idempotency (inbound mutations) ────────────────────────────────────────

export async function checkIdempotency(
  key: string,
  endpoint: string,
): Promise<{ replay: true; statusCode: number; body: unknown } | { replay: false; reused: boolean }> {
  const rec = await prisma.idempotencyRecord.findUnique({ where: { key } });
  if (!rec) return { replay: false, reused: false };
  if (rec.endpoint !== endpoint) return { replay: false, reused: true };
  let body: unknown = null;
  try {
    body = JSON.parse(rec.responseJson);
  } catch {
    body = null;
  }
  return { replay: true, statusCode: rec.statusCode, body };
}

export async function saveIdempotency(key: string, endpoint: string, statusCode: number, body: unknown) {
  await prisma.idempotencyRecord
    .create({ data: { key, endpoint, statusCode, responseJson: JSON.stringify(body) } })
    .catch(() => {});
}

export const listOutbox = (limit = 100) => prisma.outboxEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit });
