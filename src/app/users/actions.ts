"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { validatePasswordStrength } from "@/lib/auth/password";
import {
  createUser,
  updateUserProfile,
  setUserPassword,
  setUserTeams,
  setUserModuleLevels,
  activeSuperAdminCount,
  getUserTier,
} from "@/lib/users/users-service";
import { MODULES } from "@/lib/modules";

export interface FormState {
  error?: string;
  ok?: boolean;
}

export async function createUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const access = await requireModule("user_access", "MANAGE");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const tier = String(formData.get("tier") ?? "MEMBER");
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Name is required." };
  if (!email) return { error: "Email is required." };
  const pwErr = validatePasswordStrength(password);
  if (pwErr) return { error: pwErr };
  if (tier === "SUPER_ADMIN" && access.user.tier !== "SUPER_ADMIN") {
    return { error: "Only a Super Admin can grant the Super Admin tier." };
  }

  let newId: number;
  try {
    const user = await createUser({ name, email, tier, password });
    newId = user.id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create user." };
  }
  revalidatePath("/users");
  redirect(`/users/${newId}`);
}

export async function saveProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const access = await requireModule("user_access", "MANAGE");
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const tier = String(formData.get("tier") ?? "MEMBER");
  const active = formData.get("active") === "on";

  if (!name) return { error: "Name is required." };
  if (!email) return { error: "Email is required." };
  if (tier === "SUPER_ADMIN" && access.user.tier !== "SUPER_ADMIN") {
    return { error: "Only a Super Admin can grant the Super Admin tier." };
  }
  // Don't let the last active Super Admin be demoted or deactivated (self-lockout).
  const currentTier = await getUserTier(id);
  if (currentTier === "SUPER_ADMIN" && (tier !== "SUPER_ADMIN" || !active)) {
    if ((await activeSuperAdminCount()) <= 1) {
      return { error: "You can't demote or deactivate the last Super Admin." };
    }
  }
  try {
    await updateUserProfile(id, { name, email, tier, active });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }
  revalidatePath(`/users/${id}`);
  return { ok: true };
}

export async function setPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireModule("user_access", "MANAGE");
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  const pwErr = validatePasswordStrength(password);
  if (pwErr) return { error: pwErr };
  await setUserPassword(id, password);
  return { ok: true };
}

/** Save teams + per-module access levels in one go ("Save all"). */
export async function saveAccessAction(formData: FormData): Promise<void> {
  await requireModule("user_access", "MANAGE");
  const id = Number(formData.get("id"));

  const teamKeys = formData.getAll("team").map(String);

  const levels: Record<string, string> = {};
  for (const m of MODULES) {
    levels[m.key] = String(formData.get(`level.${m.key}`) ?? "NONE");
  }

  await setUserTeams(id, teamKeys);
  await setUserModuleLevels(id, levels);
  revalidatePath(`/users/${id}`);
}
