// Pure permission logic — no DB, no I/O. Unit-tested in access-logic.test.ts.

export type Level = "NONE" | "VIEW" | "OPERATE" | "MANAGE";
// THIRD_PARTY: an external account (supplier/partner). Logs in, no employee
// record, no module access by default (treated like MEMBER for permissions).
export type Tier = "SUPER_ADMIN" | "ADMIN" | "MEMBER" | "THIRD_PARTY";

export const LEVELS: Level[] = ["NONE", "VIEW", "OPERATE", "MANAGE"];

const RANK: Record<Level, number> = {
  NONE: 0,
  VIEW: 1,
  OPERATE: 2,
  MANAGE: 3,
};

export function isLevel(v: unknown): v is Level {
  return typeof v === "string" && v in RANK;
}

/** True if `have` satisfies the `need` threshold (e.g. OPERATE meets VIEW). */
export function levelMeets(have: Level, need: Level): boolean {
  return RANK[have] >= RANK[need];
}

/** Admin tiers bypass per-module permission checks entirely. */
export function isAdminTier(tier: Tier): boolean {
  return tier === "SUPER_ADMIN" || tier === "ADMIN";
}

/**
 * Effective level a user has on a module:
 * - admin tiers always get MANAGE
 * - otherwise the per-user level (defaulting to NONE)
 */
export function effectiveLevel(
  tier: Tier,
  perUserLevel: Level | undefined,
): Level {
  if (isAdminTier(tier)) return "MANAGE";
  return perUserLevel ?? "NONE";
}

/** Can the user access a module at all (level ≥ VIEW)? */
export function canAccessModule(
  tier: Tier,
  perUserLevel: Level | undefined,
): boolean {
  return levelMeets(effectiveLevel(tier, perUserLevel), "VIEW");
}
