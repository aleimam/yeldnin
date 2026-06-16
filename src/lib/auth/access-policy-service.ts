import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { isLevel, type Level } from "./access-logic";
import type { PolicyOverrides } from "./capabilities";

/** Keep only well-formed { module: { capability: Level } } entries. */
function sanitize(raw: unknown): PolicyOverrides {
  const out: PolicyOverrides = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [mod, caps] of Object.entries(raw as Record<string, unknown>)) {
    if (!caps || typeof caps !== "object") continue;
    for (const [cap, lvl] of Object.entries(caps as Record<string, unknown>)) {
      if (isLevel(lvl)) (out[mod] ??= {})[cap] = lvl;
    }
  }
  return out;
}

/** Read the capability overrides (memoized per request). */
export const getAccessPolicy = cache(async (): Promise<PolicyOverrides> => {
  const row = await prisma.accessPolicy.findUnique({ where: { id: 1 } });
  if (!row) return {};
  try {
    return sanitize(JSON.parse(row.overrides));
  } catch {
    return {};
  }
});

async function readFresh(): Promise<PolicyOverrides> {
  const row = await prisma.accessPolicy.findUnique({ where: { id: 1 } });
  if (!row) return {};
  try {
    return sanitize(JSON.parse(row.overrides));
  } catch {
    return {};
  }
}

async function persist(overrides: PolicyOverrides): Promise<void> {
  const json = JSON.stringify(sanitize(overrides));
  await prisma.accessPolicy.upsert({
    where: { id: 1 },
    create: { id: 1, overrides: json },
    update: { overrides: json },
  });
}

/** Replace one module's capability→level overrides (merging into the rest). */
export async function setModulePolicy(
  moduleKey: string,
  levels: Record<string, Level>,
): Promise<void> {
  const current = await readFresh();
  current[moduleKey] = {};
  for (const [cap, lvl] of Object.entries(levels)) {
    if (isLevel(lvl)) current[moduleKey][cap] = lvl;
  }
  await persist(current);
}

/** Drop one module's overrides so it falls back to the in-code defaults. */
export async function resetModulePolicy(moduleKey: string): Promise<void> {
  const current = await readFresh();
  delete current[moduleKey];
  await persist(current);
}
