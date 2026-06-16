import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { resolveWorkflow, type ResolvedWorkflow, type WorkflowOverrides } from "./workflow-logic";

function parse(raw: string | undefined | null): WorkflowOverrides {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? (o as WorkflowOverrides) : {};
  } catch {
    return {};
  }
}

/** Raw admin overrides for the Status Map (memoized per request). */
export const getWorkflowOverrides = cache(async (): Promise<WorkflowOverrides> => {
  const row = await prisma.workflowConfig.findUnique({ where: { id: 1 } });
  return parse(row?.overrides);
});

/** Resolved workflow (defaults + overrides) — what the app reads. */
export const getWorkflow = cache(async (): Promise<ResolvedWorkflow> => {
  return resolveWorkflow(await getWorkflowOverrides());
});

/** Persist the Status Map overrides (validated/normalized by resolveWorkflow on read). */
export async function saveWorkflowOverrides(overrides: WorkflowOverrides): Promise<void> {
  const json = JSON.stringify(overrides ?? {});
  await prisma.workflowConfig.upsert({
    where: { id: 1 },
    create: { id: 1, overrides: json },
    update: { overrides: json },
  });
}
