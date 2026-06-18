import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "./session";
import {
  type Level,
  type Tier,
  effectiveLevel,
  isAdminTier,
  levelMeets,
} from "./access-logic";
import { resolveCapabilityLevel } from "./capabilities";
import { getAccessPolicy } from "./access-policy-service";

export interface SessionUser {
  id: number;
  name: string;
  nameAr: string | null;
  email: string;
  tier: Tier;
  locale: string;
  teamKeys: string[];
  avatarUrl: string | null; // asset id, or null
}

export interface Access {
  user: SessionUser | null;
  isAdmin: boolean;
  /** Effective level for a module (admin => MANAGE). */
  moduleLevel: (moduleKey: string) => Level;
  /** level ≥ given threshold (default VIEW). Governs opening a module. */
  canModule: (moduleKey: string, min?: Level) => boolean;
  /** Holds a named capability (admins always do; else level ≥ policy minimum). */
  can: (moduleKey: string, capability: string) => boolean;
  /**
   * A non-admin whose only team is Sales: Trips & Travelers must be invisible to
   * them everywhere (nav, pages, global search). They normally lack logistics
   * access anyway; this is the hard guarantee + covers a mis-grant.
   */
  hidesTripTraveler: boolean;
}

/** Load the current session + permissions. Memoized per request. */
export const getAccess = cache(async (): Promise<Access> => {
  const userId = await getSessionUserId();
  if (!userId) return anonymous();

  const user = await prisma.user.findFirst({
    where: { id: userId, active: true, archivedAt: null },
    include: {
      teamMembers: { include: { team: true } },
      modulePerms: true,
    },
  });
  if (!user) return anonymous();

  const tier = user.tier as Tier;
  const levels = new Map<string, Level>();
  for (const p of user.modulePerms) levels.set(p.moduleKey, p.level as Level);
  const policy = await getAccessPolicy();
  const admin = isAdminTier(tier);

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    nameAr: user.nameAr ?? null,
    email: user.email,
    tier,
    locale: user.locale,
    teamKeys: user.teamMembers.map((tm) => tm.team.key),
    avatarUrl: user.avatarUrl ?? null,
  };

  const moduleLevel = (moduleKey: string): Level =>
    effectiveLevel(tier, levels.get(moduleKey));

  return {
    user: sessionUser,
    isAdmin: admin,
    moduleLevel,
    canModule: (moduleKey, min = "VIEW") => levelMeets(moduleLevel(moduleKey), min),
    can: (moduleKey, capability) =>
      admin ||
      levelMeets(moduleLevel(moduleKey), resolveCapabilityLevel(policy, moduleKey, capability)),
    hidesTripTraveler: !admin && sessionUser.teamKeys.length === 1 && sessionUser.teamKeys[0] === "sales",
  };
});

function anonymous(): Access {
  return {
    user: null,
    isAdmin: false,
    moduleLevel: () => "NONE",
    canModule: () => false,
    can: () => false,
    hidesTripTraveler: false,
  };
}

/** Redirect to /login if not authenticated; otherwise return the Access. */
export async function requireUser(): Promise<Access & { user: SessionUser }> {
  const access = await getAccess();
  if (!access.user) redirect("/login");
  return access as Access & { user: SessionUser };
}

/** Guard a module page/action by minimum level. */
export async function requireModule(
  moduleKey: string,
  min: Level = "VIEW",
): Promise<Access & { user: SessionUser }> {
  const access = await requireUser();
  if (!access.canModule(moduleKey, min)) redirect("/");
  return access;
}

/** Guard a page/action by a named capability (honors admin overrides). */
export async function requireCapability(
  moduleKey: string,
  capability: string,
): Promise<Access & { user: SessionUser }> {
  const access = await requireUser();
  if (!access.can(moduleKey, capability)) redirect("/");
  return access;
}

/** Guard a page/action to admin tiers only (Super Admin / Admin). */
export async function requireAdmin(): Promise<Access & { user: SessionUser }> {
  const access = await requireUser();
  if (!access.isAdmin) redirect("/");
  return access;
}
