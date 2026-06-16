"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import {
  createTeam,
  renameTeam,
  addMember,
  removeMember,
  deleteTeam,
} from "@/lib/teams/teams-service";

export async function createTeamAction(fd: FormData): Promise<void> {
  const access = await requireModule("user_access", "MANAGE");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  const team = await createTeam(name);
  await writeAudit(access.user.id, "user_access", "team.create", "team", team.id, { name });
  redirect(`/users/teams/${team.id}`);
}

export async function renameTeamAction(fd: FormData): Promise<void> {
  const access = await requireModule("user_access", "MANAGE");
  const id = Number(fd.get("id"));
  const name = String(fd.get("name") ?? "").trim();
  if (!id || !name) return;
  await renameTeam(id, name);
  await writeAudit(access.user.id, "user_access", "team.rename", "team", id, { name });
  revalidatePath(`/users/teams/${id}`);
}

export async function addMemberAction(fd: FormData): Promise<void> {
  await requireModule("user_access", "MANAGE");
  const teamId = Number(fd.get("teamId"));
  const userId = Number(fd.get("userId"));
  if (!teamId || !userId) return;
  await addMember(teamId, userId);
  revalidatePath(`/users/teams/${teamId}`);
}

export async function removeMemberAction(fd: FormData): Promise<void> {
  await requireModule("user_access", "MANAGE");
  const teamId = Number(fd.get("teamId"));
  const userId = Number(fd.get("userId"));
  if (!teamId || !userId) return;
  await removeMember(teamId, userId);
  revalidatePath(`/users/teams/${teamId}`);
}

export async function deleteTeamAction(fd: FormData): Promise<void> {
  const access = await requireModule("user_access", "MANAGE");
  const id = Number(fd.get("id"));
  if (!id) return;
  await deleteTeam(id);
  await writeAudit(access.user.id, "user_access", "team.delete", "team", id);
  redirect("/users/teams");
}
