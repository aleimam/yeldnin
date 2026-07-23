"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { createCycle, extendDeadline, closeCycle } from "@/lib/evaluation/eval-cycle-service";
import { saved, saveError, type SaveState } from "@/lib/forms/action-state";

/** Map the cycle-service validation messages to i18n error keys for <ActionForm>. */
function cycleErrKey(msg: string): string {
  if (msg.includes("already open")) return "eval.err.cycleOpen";
  if (msg.includes("at least one department")) return "eval.err.noTeams";
  if (msg.includes("deadline")) return "eval.err.deadline";
  if (msg.includes("Not enough staff")) return "eval.err.tooFewStaff";
  if (msg.includes("name is required")) return "eval.err.nameReq";
  return "common.saveError";
}

export async function createCycleAction(prev: SaveState, fd: FormData): Promise<SaveState> {
  const access = await requireCapability("evaluation", "manage");
  const name = String(fd.get("name") ?? "").trim();
  const deadline = String(fd.get("deadline") ?? "");
  const teamIds = fd.getAll("teamIds").map((v) => Number(v)).filter((n) => Number.isInteger(n));
  const effortWeight = Number(fd.get("effortWeight") ?? 15);
  let id: number;
  try {
    id = await createCycle({ name, deadline, teamIds, effortWeight }, access.user.id);
  } catch (e) {
    return saveError(prev, cycleErrKey(e instanceof Error ? e.message : ""));
  }
  await writeAudit(access.user.id, "evaluation", "cycle.open", "evalCycle", id, { name, teams: teamIds.length });
  revalidatePath("/evaluation/cycles");
  redirect(`/evaluation/cycles/${id}`);
}

export async function extendDeadlineAction(prev: SaveState, fd: FormData): Promise<SaveState> {
  const access = await requireCapability("evaluation", "manage");
  const id = Number(fd.get("id"));
  const deadline = String(fd.get("deadline") ?? "");
  if (!id) return saveError(prev);
  try {
    await extendDeadline(id, deadline);
    await writeAudit(access.user.id, "evaluation", "cycle.extend", "evalCycle", id, { deadline });
    revalidatePath(`/evaluation/cycles/${id}`);
    return saved(prev);
  } catch {
    return saveError(prev, "eval.err.deadline");
  }
}

export async function closeCycleAction(fd: FormData): Promise<void> {
  const access = await requireCapability("evaluation", "manage");
  const id = Number(fd.get("id"));
  if (!id) return;
  await closeCycle(id);
  await writeAudit(access.user.id, "evaluation", "cycle.close", "evalCycle", id);
  revalidatePath(`/evaluation/cycles/${id}`);
  revalidatePath("/evaluation/cycles");
}
