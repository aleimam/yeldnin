import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret-box";
import { isValidBaseUrl, keyHint, INBOUND_KEY_PREFIX } from "./integrations-logic";

const VEEEY = "VEEEY";

/** The integration row, creating the VEEEY one on first access (seed-safe). */
async function getRow(provider: string = VEEEY) {
  const row = await prisma.apiIntegration.findUnique({ where: { provider } });
  if (row) return row;
  return prisma.apiIntegration.create({ data: { provider, name: "Veeey storefront", enabled: false } });
}

export interface IntegrationView {
  provider: string;
  name: string;
  enabled: boolean;
  baseUrl: string | null;
  hasOutboundSecret: boolean; // the secret itself is never sent to the client
  inboundKeyHint: string | null;
  inboundKeyAt: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
}

/** Browser-safe projection — no secrets, only whether one is set. */
export async function veeeyView(): Promise<IntegrationView> {
  const r = await getRow();
  return {
    provider: r.provider,
    name: r.name,
    enabled: r.enabled,
    baseUrl: r.baseUrl,
    hasOutboundSecret: !!r.outboundSecret,
    inboundKeyHint: r.inboundKeyHint,
    inboundKeyAt: r.inboundKeyAt ? r.inboundKeyAt.toISOString() : null,
    lastTestAt: r.lastTestAt ? r.lastTestAt.toISOString() : null,
    lastTestOk: r.lastTestOk,
    lastTestMessage: r.lastTestMessage,
  };
}

export interface SaveConnectionInput {
  baseUrl?: string | null;
  /** New outbound secret. Empty/undefined = keep the stored one unchanged. */
  outboundSecret?: string | null;
  enabled: boolean;
}

/** Save the outbound connection. The secret is encrypted at rest and only replaced
 *  when a non-empty value is supplied, so saving other fields keeps it intact. */
export async function saveVeeeyConnection(input: SaveConnectionInput, userId: number) {
  const baseUrl = clean(input.baseUrl);
  if (baseUrl && !isValidBaseUrl(baseUrl)) throw new Error("Enter a valid http(s) base URL.");
  const secret = input.outboundSecret?.trim();
  await prisma.apiIntegration.update({
    where: { provider: VEEEY },
    data: {
      baseUrl,
      enabled: input.enabled,
      ...(secret ? { outboundSecret: encryptSecret(secret) } : {}),
      updatedById: userId,
    },
  });
}

/** Generate a fresh inbound API key for VEEEY to authenticate against us. Stores
 *  only its sha256 hash + a display hint, and returns the plaintext ONCE. */
export async function regenerateInboundKey(userId: number): Promise<string> {
  await getRow();
  const key = `${INBOUND_KEY_PREFIX}${crypto.randomBytes(24).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  await prisma.apiIntegration.update({
    where: { provider: VEEEY },
    data: { inboundKeyHash: hash, inboundKeyHint: keyHint(key), inboundKeyAt: new Date(), updatedById: userId },
  });
  return key;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

/** Reachability check: GET the configured base URL with the outbound secret as a
 *  Bearer token, recording the outcome. No live data is exchanged — it only
 *  confirms the URL responds and the credentials are wired. */
export async function testVeeeyConnection(userId: number): Promise<TestResult> {
  const r = await getRow();
  let result: TestResult;
  if (!r.baseUrl) {
    result = { ok: false, message: "Set a base URL first." };
  } else {
    const secret = decryptSecret(r.outboundSecret);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(r.baseUrl, {
        method: "GET",
        headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      result = { ok: res.ok, message: `HTTP ${res.status} ${res.statusText}`.trim() };
    } catch (e) {
      result = { ok: false, message: e instanceof Error ? e.message : "Request failed." };
    }
  }
  await prisma.apiIntegration.update({
    where: { provider: VEEEY },
    data: { lastTestAt: new Date(), lastTestOk: result.ok, lastTestMessage: result.message, updatedById: userId },
  });
  return result;
}
