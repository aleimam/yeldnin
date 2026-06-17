import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { resolveSla, type SlaSettings, type SlaSettingsInput } from "./sla-logic";

function parse(raw: string | undefined | null): SlaSettingsInput {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? (o as SlaSettingsInput) : {};
  } catch {
    return {};
  }
}

/** Raw stored SLA overrides (memoized per request). */
export const getSlaOverrides = cache(async (): Promise<SlaSettingsInput> => {
  const row = await prisma.slaConfig.findUnique({ where: { id: 1 } });
  return parse(row?.config);
});

/** Resolved SLA settings (defaults + overrides) — what the app reads. */
export const getSla = cache(async (): Promise<SlaSettings> => {
  return resolveSla(await getSlaOverrides());
});

/** Persist SLA settings (stored as the fully-resolved object). */
export async function saveSla(settings: SlaSettingsInput): Promise<void> {
  const json = JSON.stringify(resolveSla(settings));
  await prisma.slaConfig.upsert({
    where: { id: 1 },
    create: { id: 1, config: json },
    update: { config: json },
  });
}
