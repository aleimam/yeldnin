"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import {
  createCategory, updateCategory, archiveCategory,
  createTemplate, updateTemplate, archiveTemplate,
  createCriterion, updateCriterion, archiveCriterion,
  createEvent, updateEvent, archiveEvent,
  setEventEligibles, setAchievement,
} from "@/lib/hr/engagement-service";

/** Engagement = HR manage (or admin). */
async function requireHrManage() {
  const access = await requireUser();
  if (access.isAdmin || access.can("human_resources", "manage")) return access;
  redirect("/");
}

type Result = { ok: true } | { ok: false; error: string };
type CreatedResult = { ok: true; id: number } | { ok: false; error: string };

async function run(label: string, revalidate: string[], fn: (userId: number) => Promise<void>): Promise<Result> {
  const access = await requireHrManage();
  try {
    await fn(access.user.id);
    await writeAudit(access.user.id, "human_resources", label, "engagement", "x");
    for (const p of revalidate) revalidatePath(p);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save." };
  }
}

// ── Catalog (Settings) ───────────────────────────────────────────────────────
export async function createCategoryAction(i: { name: string; nameAr?: string | null }) { return run("eng.category.create", ["/hr/setup"], (u) => createCategory(i, u)); }
export async function updateCategoryAction(id: number, i: { name: string; nameAr?: string | null }) { return run("eng.category.update", ["/hr/setup"], (u) => updateCategory(id, i, u)); }
export async function archiveCategoryAction(id: number) { return run("eng.category.archive", ["/hr/setup"], (u) => archiveCategory(id, u)); }

export async function createTemplateAction(i: { name: string; nameAr?: string | null; categoryId?: number | null; description?: string | null }) { return run("eng.template.create", ["/hr/setup"], (u) => createTemplate(i, u)); }
export async function updateTemplateAction(id: number, i: { name: string; nameAr?: string | null; categoryId?: number | null; description?: string | null }) { return run("eng.template.update", ["/hr/setup"], (u) => updateTemplate(id, i, u)); }
export async function archiveTemplateAction(id: number) { return run("eng.template.archive", ["/hr/setup"], (u) => archiveTemplate(id, u)); }

export async function createCriterionAction(templateId: number, i: { name: string; nameAr?: string | null; bonusAmount: number }) { return run("eng.criterion.create", ["/hr/setup"], () => createCriterion(templateId, i)); }
export async function updateCriterionAction(id: number, i: { name: string; nameAr?: string | null; bonusAmount: number }) { return run("eng.criterion.update", ["/hr/setup"], () => updateCriterion(id, i)); }
export async function archiveCriterionAction(id: number) { return run("eng.criterion.archive", ["/hr/setup"], () => archiveCriterion(id)); }

// ── Events ───────────────────────────────────────────────────────────────────
export async function createEventAction(i: { templateId: number; year: number; month: number; title?: string | null; notes?: string | null }): Promise<CreatedResult> {
  const access = await requireHrManage();
  if (!i.templateId) return { ok: false, error: "Choose an event template." };
  if (!(i.month >= 1 && i.month <= 12) || !i.year) return { ok: false, error: "Choose a valid pay-month." };
  try {
    const ev = await createEvent(i, access.user.id);
    await writeAudit(access.user.id, "human_resources", "eng.event.create", "engagement", ev.id);
    revalidatePath("/hr/engagement");
    return { ok: true, id: ev.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create the event." };
  }
}
export async function updateEventAction(id: number, i: { year: number; month: number; title?: string | null; notes?: string | null }) { return run("eng.event.update", [`/hr/engagement/${id}`, "/hr/engagement"], (u) => updateEvent(id, i, u)); }
export async function archiveEventAction(id: number) { return run("eng.event.archive", ["/hr/engagement"], (u) => archiveEvent(id, u)); }
export async function setEventEligiblesAction(eventId: number, employeeIds: number[]) { return run("eng.event.eligibles", [`/hr/engagement/${eventId}`], (u) => setEventEligibles(eventId, employeeIds, u)); }
export async function setAchievementAction(eventId: number, criterionId: number, employeeId: number, on: boolean) { return run("eng.event.achievement", [`/hr/engagement/${eventId}`], (u) => setAchievement(eventId, criterionId, employeeId, on, u)); }
