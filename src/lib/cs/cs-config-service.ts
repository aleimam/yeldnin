import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { resolveCsConfig, type CsConfigShape } from "./cs-logic";

/** Per-scope answer-value maps (defaults + stored overrides). Memoized per request. */
export const getCsConfig = cache(async (): Promise<CsConfigShape> => {
  const row = await prisma.csConfig.findUnique({ where: { id: 1 } });
  let raw: unknown = null;
  if (row?.config) {
    try {
      raw = JSON.parse(row.config);
    } catch {
      raw = null;
    }
  }
  return resolveCsConfig(raw as { call?: Partial<CsConfigShape["call"]>; performance?: Partial<CsConfigShape["performance"]> } | null);
});

export async function saveCsConfig(input: CsConfigShape, userId: number): Promise<void> {
  const json = JSON.stringify(resolveCsConfig(input));
  await prisma.csConfig.upsert({ where: { id: 1 }, create: { id: 1, config: json }, update: { config: json } });
  await writeAudit(userId, "cs_quality", "config.save", "csConfig", 1, {});
}
