// Pure CS Quality scoring logic. No DB/IO. Unit-tested.
import type { Level } from "@/lib/auth/access-logic";

export const CS_SCOPES = ["CALL", "PERFORMANCE"] as const;
export type CsScope = (typeof CS_SCOPES)[number];

// Worst → best. Catastrophe shows red, Outstanding green.
export const CS_LEVELS = ["CATASTROPHE", "BAD", "GOOD", "PERFECT", "OUTSTANDING"] as const;
export type CsLevel = (typeof CS_LEVELS)[number];

export type ValueMap = Record<CsLevel, number>;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Default answer values (monotonic) — identical for both scopes; admin-editable. */
export const DEFAULT_VALUES: ValueMap = {
  CATASTROPHE: -1,
  BAD: 0,
  GOOD: 0.5,
  PERFECT: 1,
  OUTSTANDING: 1.5,
};

export interface CsConfigShape {
  call: ValueMap;
  performance: ValueMap;
}
export const DEFAULT_CS_CONFIG: CsConfigShape = {
  call: { ...DEFAULT_VALUES },
  performance: { ...DEFAULT_VALUES },
};

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function mergeMap(raw: Partial<ValueMap> | undefined): ValueMap {
  return {
    CATASTROPHE: num(raw?.CATASTROPHE, DEFAULT_VALUES.CATASTROPHE),
    BAD: num(raw?.BAD, DEFAULT_VALUES.BAD),
    GOOD: num(raw?.GOOD, DEFAULT_VALUES.GOOD),
    PERFECT: num(raw?.PERFECT, DEFAULT_VALUES.PERFECT),
    OUTSTANDING: num(raw?.OUTSTANDING, DEFAULT_VALUES.OUTSTANDING),
  };
}

/** Merge a stored (possibly partial) config over the defaults. Tolerant of junk. */
export function resolveCsConfig(raw?: { call?: Partial<ValueMap>; performance?: Partial<ValueMap> } | null): CsConfigShape {
  return { call: mergeMap(raw?.call), performance: mergeMap(raw?.performance) };
}

export function isCsLevel(v: unknown): v is CsLevel {
  return typeof v === "string" && (CS_LEVELS as readonly string[]).includes(v);
}

/** Answer value for a level (0 for an unknown level). */
export function valueFor(map: ValueMap, level: string): number {
  return isCsLevel(level) ? map[level] : 0;
}

/** Coerce a weight into the allowed integer 1..10 range. */
export function clampWeight(w: number): number {
  return Math.max(1, Math.min(10, Math.round(w || 1)));
}

export interface ScoredAnswer {
  weight: number;
  value: number; // resolved answer value
}

/** Σ(value × weight), rounded. */
export function weightedTotal(answers: ScoredAnswer[]): number {
  return round2(answers.reduce((s, a) => s + a.value * a.weight, 0));
}

/**
 * Score as a % of the best possible (top answer value × Σ weights). Negative
 * totals clamp to 0; a non-positive ceiling (no answers / non-positive map)
 * yields 0.
 */
export function normalizedPct(answers: ScoredAnswer[], map: ValueMap): number {
  const best = Math.max(...CS_LEVELS.map((l) => map[l]));
  const sumW = answers.reduce((s, a) => s + a.weight, 0);
  const ceiling = best * sumW;
  if (ceiling <= 0) return 0;
  const total = answers.reduce((s, a) => s + a.value * a.weight, 0);
  return round2(Math.max(0, (total / ceiling) * 100));
}

// ── Access — governed by the per-user `cs_quality` module level (admins always
// resolve to MANAGE). VIEW = open module (criteria + own evals); OPERATE = evaluate
// CALLS (the Development team's level); MANAGE = evaluate performance + approve +
// manage questions/config. ──

/** Module key whose per-user level (NONE/VIEW/OPERATE/MANAGE) governs CS access. */
export const CS_MODULE = "cs_quality";
/** The `sales` team's key — its members are the evaluated population (pharmacists). */
export const SALES_TEAM_KEY = "sales";

export interface CsAccess {
  isAdmin: boolean;
  user: { teamKeys: string[] } | null;
  canModule: (moduleKey: string, min?: Level) => boolean;
}

/** Open the module — read-only (criteria + one's own evaluations). VIEW+. */
export const canAccessCs = (a: CsAccess): boolean => a.canModule(CS_MODULE, "VIEW");
/** Evaluate calls. OPERATE+ (the Development team's level). */
export const canEvaluateCalls = (a: CsAccess): boolean => a.canModule(CS_MODULE, "OPERATE");
/** Evaluate performance + approve + manage questions/types/values + analytics. MANAGE. */
export const canManageCs = (a: CsAccess): boolean => a.canModule(CS_MODULE, "MANAGE");
/** The evaluated population — members of the Sales team (pharmacists). */
export const isRep = (a: CsAccess): boolean => !!a.user?.teamKeys.includes(SALES_TEAM_KEY);
