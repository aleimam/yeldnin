import "server-only";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto/secret-box";

/**
 * YeldnIN ↔ Veeey integration config (Requests epic Phase D). Unlike Veeey (which
 * reads env vars), YeldnIN reads the single `ApiIntegration` row (provider
 * "VEEEY") managed from the admin Integration screen. The integration ships
 * DISABLED: the row seeds `enabled:false`, so every gated surface (inbound routes
 * 404, no outbound emission) stays inert until the owner enables it AND stores a
 * secret.
 *
 * ⚠️ SHARED SECRET: the row's decrypted `outboundSecret` is the ONE HMAC secret,
 * used BOTH to sign our outbound webhooks to Veeey AND to verify Veeey's inbound
 * calls to us. It must be byte-identical to what Veeey holds in its
 * `INTEGRATION_CLIENT_VEEEY_SECRET` env var. There is no separate inbound key for
 * the request sync — HMAC is symmetric here by design (matches the contract).
 */

const VEEEY = "VEEEY";

/** Both sides' client ids (sent as `X-Client-Id`, and namespacing nonces). */
export const YELDNIN_CLIENT_ID = "yeldnin";
export const VEEEY_CLIENT_ID = "veeey";

/** Veeey's inbound webhook path — where our outbound `request.upsert` lands. The
 *  HMAC signing path is derived from the resolved target URL so it always matches
 *  what Veeey's verifier reads from `url.pathname` (see integration-service). */
export const VEEEY_WEBHOOK_PATH = "/api/integration/yeldnin/webhook";

/** Retry backoff: 1m → 5m → 30m → 2h → 12h, then DEAD (shared contract §5). */
export const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];

/** Outbox event type → Veeey endpoint path. YeldnIN only emits request upserts,
 *  all delivered to the single webhook (enveloped); kept as a map to mirror
 *  Veeey's OUTBOX_PATHS shape and leave room for future event types. */
export const OUTBOX_PATHS: Record<string, string> = {
  "request.upsert": VEEEY_WEBHOOK_PATH,
  "delivery.tracking": VEEEY_WEBHOOK_PATH,
  "shipment.received": VEEEY_WEBHOOK_PATH,
};

export interface IntegrationConfig {
  enabled: boolean;
  secret: string | null;
  baseUrl: string | null;
}

/** Single read of the VEEEY row → the config the service layer needs. `enabled`
 *  is true only when the admin toggle is on AND a decryptable secret is present
 *  (a rotated SESSION_SECRET makes the stored secret unreadable → treated as off). */
export async function integrationConfig(): Promise<IntegrationConfig> {
  const r = await prisma.apiIntegration.findUnique({ where: { provider: VEEEY } });
  const secret = r ? decryptSecret(r.outboundSecret) : null;
  return { enabled: !!(r?.enabled && secret), secret, baseUrl: r?.baseUrl ?? null };
}

export async function integrationEnabled(): Promise<boolean> {
  return (await integrationConfig()).enabled;
}

export async function veeeySecret(): Promise<string | null> {
  return (await integrationConfig()).secret;
}

export async function veeeyBaseUrl(): Promise<string | null> {
  return (await integrationConfig()).baseUrl;
}

/**
 * Resolve the stored baseUrl into the concrete webhook target + its signing path.
 *
 * baseUrl semantics: the admin may store either the Veeey **origin**
 * (`https://veeey.com`) or the **full webhook URL** — we accept both. If it does
 * not already end in the webhook path we append it. The signing path is the
 * resolved URL's pathname so it byte-matches Veeey's `verifyInbound` (which reads
 * `new URL(req.url).pathname`), regardless of which form was stored.
 * Returns null when baseUrl is absent or not a valid http(s) URL.
 */
export function veeeyWebhookTarget(baseUrl: string | null): { url: string; path: string } | null {
  if (!baseUrl) return null;
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const full = trimmed.endsWith(VEEEY_WEBHOOK_PATH) ? trimmed : `${trimmed}${VEEEY_WEBHOOK_PATH}`;
  try {
    const u = new URL(full);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return { url: u.toString(), path: u.pathname };
  } catch {
    return null;
  }
}
