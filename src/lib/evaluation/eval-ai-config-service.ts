import "server-only";
import { prisma } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret-box";

// The Claude API key lives in the shared encrypted vault (ApiIntegration row,
// provider "ANTHROPIC"). `baseUrl` is repurposed to hold the model id for this
// provider; `outboundSecret` holds the AES-256-GCM-encrypted key.
const PROVIDER = "ANTHROPIC";
export const DEFAULT_AI_MODEL = "claude-sonnet-5"; // Sonnet default; Opus premium

function hint(key: string): string {
  return key.length > 12 ? `${key.slice(0, 7)}…${key.slice(-4)}` : "set";
}

export interface AiConfigView {
  configured: boolean;
  model: string;
  keyHint: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
}

export async function getAiConfig(): Promise<AiConfigView> {
  const row = await prisma.apiIntegration.findUnique({ where: { provider: PROVIDER } });
  const key = decryptSecret(row?.outboundSecret);
  return {
    configured: !!key,
    model: row?.baseUrl?.trim() || DEFAULT_AI_MODEL,
    keyHint: row?.inboundKeyHint ?? null,
    lastTestOk: row?.lastTestOk ?? null,
    lastTestMessage: row?.lastTestMessage ?? null,
  };
}

/** Decrypted key + model — server generator only. null when not configured. */
export async function getAiKeyAndModel(): Promise<{ key: string; model: string } | null> {
  const row = await prisma.apiIntegration.findUnique({ where: { provider: PROVIDER } });
  const key = decryptSecret(row?.outboundSecret);
  if (!key) return null;
  return { key, model: row?.baseUrl?.trim() || DEFAULT_AI_MODEL };
}

export async function saveAiConfig(input: { apiKey?: string; model?: string }, userId: number): Promise<void> {
  const model = (input.model ?? "").trim() || DEFAULT_AI_MODEL;
  const apiKey = input.apiKey?.trim();
  const secretPatch = apiKey ? { outboundSecret: encryptSecret(apiKey), inboundKeyHint: hint(apiKey) } : {};
  await prisma.apiIntegration.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, name: "Anthropic (Claude)", baseUrl: model, ...secretPatch, createdById: userId },
    update: { baseUrl: model, ...secretPatch, updatedById: userId },
  });
}

export async function recordAiTest(ok: boolean, message: string): Promise<void> {
  await prisma.apiIntegration
    .update({ where: { provider: PROVIDER }, data: { lastTestAt: new Date(), lastTestOk: ok, lastTestMessage: message.slice(0, 200) } })
    .catch(() => {});
}
