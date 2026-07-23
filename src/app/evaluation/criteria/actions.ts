"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import {
  createPillar,
  updatePillar,
  archivePillar,
  createCriterion,
  updateCriterion,
  archiveCriterion,
} from "@/lib/evaluation/eval-config-service";

const REVALIDATE = "/evaluation/criteria";

export async function createPillarAction(fd: FormData): Promise<void> {
  const access = await requireCapability("evaluation", "manage");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  await createPillar({ name, nameAr: String(fd.get("nameAr") ?? "") });
  await writeAudit(access.user.id, "evaluation", "pillar.create", "evalPillar", 0, { name });
  revalidatePath(REVALIDATE);
}

export async function updatePillarAction(fd: FormData): Promise<void> {
  const access = await requireCapability("evaluation", "manage");
  const id = Number(fd.get("id"));
  const name = String(fd.get("name") ?? "").trim();
  if (!id || !name) return;
  const teamIds = fd.getAll("teamIds").map((v) => Number(v)).filter((n) => Number.isInteger(n));
  await updatePillar(id, { name, nameAr: String(fd.get("nameAr") ?? ""), teamIds });
  await writeAudit(access.user.id, "evaluation", "pillar.update", "evalPillar", id, { teams: teamIds.length });
  revalidatePath(REVALIDATE);
}

export async function archivePillarById(id: number): Promise<void> {
  const access = await requireCapability("evaluation", "manage");
  if (!id) return;
  await archivePillar(id);
  await writeAudit(access.user.id, "evaluation", "pillar.archive", "evalPillar", id);
  revalidatePath(REVALIDATE);
}

export async function createCriterionAction(fd: FormData): Promise<void> {
  const access = await requireCapability("evaluation", "manage");
  const pillarId = Number(fd.get("pillarId"));
  const title = String(fd.get("title") ?? "").trim();
  if (!pillarId || !title) return;
  await createCriterion({ pillarId, title, text: String(fd.get("text") ?? "") });
  await writeAudit(access.user.id, "evaluation", "criterion.create", "evalPillar", pillarId, { title });
  revalidatePath(REVALIDATE);
}

export async function updateCriterionAction(fd: FormData): Promise<void> {
  const access = await requireCapability("evaluation", "manage");
  const id = Number(fd.get("id"));
  const title = String(fd.get("title") ?? "").trim();
  if (!id || !title) return;
  await updateCriterion(id, {
    title,
    titleAr: String(fd.get("titleAr") ?? ""),
    text: String(fd.get("text") ?? ""),
    textAr: String(fd.get("textAr") ?? ""),
    raterScope: String(fd.get("raterScope") ?? "ANY"),
  });
  await writeAudit(access.user.id, "evaluation", "criterion.update", "evalCriterion", id);
  revalidatePath(REVALIDATE);
}

export async function archiveCriterionById(id: number): Promise<void> {
  const access = await requireCapability("evaluation", "manage");
  if (!id) return;
  await archiveCriterion(id);
  await writeAudit(access.user.id, "evaluation", "criterion.archive", "evalCriterion", id);
  revalidatePath(REVALIDATE);
}
