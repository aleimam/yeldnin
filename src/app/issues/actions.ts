"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { validateIssue, validateCompensation } from "@/lib/issues/issues-logic";
import { createIssue, resolveIssue, reopenIssue, addCompensation } from "@/lib/issues/issues-service";
import { writeAudit } from "@/lib/audit";

export interface IssuePayload {
  title: string;
  note?: string;
  scope?: string;
  photoIds?: string[];
}
export type IssueResult = { ok: true; id: number } | { ok: false; error: string };

export async function createIssueAction(p: IssuePayload): Promise<IssueResult> {
  const access = await requireCapability("issues", "operate");
  const errs = validateIssue(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  const issue = await createIssue({ title: p.title, note: p.note ?? null, scope: p.scope ?? null }, p.photoIds ?? [], [], access.user.id);
  await writeAudit(access.user.id, "issues", "issue.create", "issue", issue.id, { title: p.title });
  revalidatePath("/issues");
  return { ok: true, id: issue.id };
}

export async function resolveIssueAction(id: number): Promise<void> {
  const access = await requireCapability("issues", "operate");
  await resolveIssue(id, access.user.id);
  await writeAudit(access.user.id, "issues", "issue.resolve", "issue", id);
  revalidatePath(`/issues/${id}`);
  revalidatePath("/issues");
}
export async function reopenIssueAction(id: number): Promise<void> {
  const access = await requireCapability("issues", "operate");
  await reopenIssue(id, access.user.id);
  await writeAudit(access.user.id, "issues", "issue.reopen", "issue", id);
  revalidatePath(`/issues/${id}`);
  revalidatePath("/issues");
}

export async function addCompensationAction(p: {
  issueId: number;
  type: string;
  amountEgp?: number | null;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const access = await requireCapability("issues", "operate");
  const errs = validateCompensation(p);
  if (Object.keys(errs).length) return { ok: false, error: Object.values(errs)[0] };
  await addCompensation(p.issueId, { type: p.type, amountEgp: p.amountEgp ?? null, note: p.note ?? null }, access.user.id);
  await writeAudit(access.user.id, "issues", "compensation.add", "issue", p.issueId, { type: p.type });
  revalidatePath(`/issues/${p.issueId}`);
  return { ok: true };
}
