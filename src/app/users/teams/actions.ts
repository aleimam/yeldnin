"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import {
  createTeam,
  renameTeam,
  addMember,
  removeMember,
  deleteTeam,
} from "@/lib/teams/teams-service";
import { setTeamConnections } from "@/lib/evaluation/team-connections-service";
import { saved, saveError, type SaveState } from "@/lib/forms/action-state";

/** Set a team's connected departments (360 Reviews graph) — reciprocal. */
export async function setTeamConnectionsAction(fd: FormData): Promise<void> {
  const access = await requireCapability("user_access", "manageTeams");
  const teamId = Number(fd.get("teamId"));
  const ids = fd.getAll("connectedIds").map((v) => Number(v)).filter((n) => Number.isInteger(n));
  await setTeamConnections(teamId, ids);
  await writeAudit(access.user.id, "user_access", "team.connections", "team", teamId, { count: ids.length });
  revalidatePath(`/users/teams/${teamId}`);
}

export async function createTeamAction(fd: FormData): Promise<void> {
  const access = await requireCapability("user_access", "manageTeams");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  const team = await createTeam(name);
  await writeAudit(access.user.id, "user_access", "team.create", "team", team.id, { name });
  redirect(`/users/teams/${team.id}`);
}

export async function renameTeamAction(prev: SaveState, fd: FormData): Promise<SaveState> {
  const access = await requireCapability("user_access", "manageTeams");
  const id = Number(fd.get("id"));
  const name = String(fd.get("name") ?? "").trim();
  if (!id || !name) return saveError(prev);
  try {
    await renameTeam(id, name);
    await writeAudit(access.user.id, "user_access", "team.rename", "team", id, { name });
    revalidatePath(`/users/teams/${id}`);
    return saved(prev);
  } catch {
    return saveError(prev);
  }
}

export async function addMemberAction(fd: FormData): Promise<void> {
  await requireCapability("user_access", "manageTeams");
  const teamId = Number(fd.get("teamId"));
  const userId = Number(fd.get("userId"));
  if (!teamId || !userId) return;
  await addMember(teamId, userId);
  revalidatePath(`/users/teams/${teamId}`);
}

export async function removeMemberAction(fd: FormData): Promise<void> {
  await requireCapability("user_access", "manageTeams");
  const teamId = Number(fd.get("teamId"));
  const userId = Number(fd.get("userId"));
  if (!teamId || !userId) return;
  await removeMember(teamId, userId);
  revalidatePath(`/users/teams/${teamId}`);
}

export async function deleteTeamAction(fd: FormData): Promise<void> {
  const access = await requireCapability("user_access", "manageTeams");
  const id = Number(fd.get("id"));
  if (!id) return;
  await deleteTeam(id);
  await writeAudit(access.user.id, "user_access", "team.delete", "team", id);
  redirect("/users/teams");
}
