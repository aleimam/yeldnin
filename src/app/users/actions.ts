"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
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
import { writeAudit } from "@/lib/audit";

export interface FormState {
  error?: string;
  ok?: boolean;
}

interface ProfilePayload {
  name: string;
  nameAr?: string;
  uid?: string;
  fullName?: string;
  fullNameAr?: string;
  username?: string;
  email: string;
  tier: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  yeldnPhone?: string;
  avatarId?: string | null;
}
export type UserResult = { ok: true; id: number } | { ok: false; error: string };

export async function createUserAction(
  p: ProfilePayload & { password: string },
): Promise<UserResult> {
  const access = await requireCapability("user_access", "manageUsers");
  if (!p.name?.trim()) return { ok: false, error: "Name is required." };
  if (!p.email?.trim()) return { ok: false, error: "Email is required." };
  const pwErr = validatePasswordStrength(p.password);
  if (pwErr) return { ok: false, error: pwErr };
  if (p.tier === "SUPER_ADMIN" && access.user.tier !== "SUPER_ADMIN") {
    return { ok: false, error: "Only a Super Admin can grant the Super Admin tier." };
  }
  try {
    const user = await createUser({ ...p, avatarUrl: p.avatarId ?? null });
    await writeAudit(access.user.id, "user_access", "user.create", "user", user.id, { email: p.email });
    revalidatePath("/users");
    return { ok: true, id: user.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create user." };
  }
}

export async function saveProfileAction(
  p: ProfilePayload & { id: number; active: boolean },
): Promise<UserResult> {
  const access = await requireCapability("user_access", "manageUsers");
  if (!p.name?.trim()) return { ok: false, error: "Name is required." };
  if (!p.email?.trim()) return { ok: false, error: "Email is required." };
  if (p.tier === "SUPER_ADMIN" && access.user.tier !== "SUPER_ADMIN") {
    return { ok: false, error: "Only a Super Admin can grant the Super Admin tier." };
  }
  const currentTier = await getUserTier(p.id);
  if (currentTier === "SUPER_ADMIN" && (p.tier !== "SUPER_ADMIN" || !p.active)) {
    if ((await activeSuperAdminCount()) <= 1) {
      return { ok: false, error: "You can't demote or deactivate the last Super Admin." };
    }
  }
  try {
    await updateUserProfile(p.id, { ...p, avatarUrl: p.avatarId ?? null });
    await writeAudit(access.user.id, "user_access", "user.profile.update", "user", p.id, { tier: p.tier });
    revalidatePath(`/users/${p.id}`);
    return { ok: true, id: p.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save." };
  }
}

export async function setPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const access = await requireCapability("user_access", "manageUsers");
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  const pwErr = validatePasswordStrength(password);
  if (pwErr) return { error: pwErr };
  await setUserPassword(id, password);
  await writeAudit(access.user.id, "user_access", "user.password.set", "user", id);
  return { ok: true };
}

/** Save teams + per-module access levels in one go ("Save all"). */
export async function saveAccessAction(payload: {
  userId: number;
  teamKeys: string[];
  levels: Record<string, string>;
}): Promise<void> {
  const access = await requireCapability("user_access", "manageUsers");
  await setUserTeams(payload.userId, payload.teamKeys);
  await setUserModuleLevels(payload.userId, payload.levels);
  await writeAudit(access.user.id, "user_access", "user.access.update", "user", payload.userId);
  revalidatePath(`/users/${payload.userId}`);
}
