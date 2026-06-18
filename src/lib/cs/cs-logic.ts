// Pure CS Quality scoring logic. No DB/IO. Unit-tested.
import type { Level } from "@/lib/auth/access-logic";

export const CS_SCOPES = ["CALL", "PERFORMANCE"] as const;
export type CsScope = (typeof CS_SCOPES)[number];

// Worst → best. Catastrophe shows red, Outstanding green.
export const CS_LEVELS = ["CATASTROPHE", "BAD", "GOOD", "PERFECT", "OUTSTANDING"] as const;
export type CsLevel = (typeof CS_LEVELS)[number];

// Contact channels for a call evaluation (fixed list). Stored as the key on the
// evaluation; the label is i18n'd via `cs.channel.<KEY>` (bilingual).
export const CS_CHANNELS = ["WHATSAPP", "PHONE", "FACEBOOK", "INSTAGRAM"] as const;
export type CsChannel = (typeof CS_CHANNELS)[number];
export const isCsChannel = (v: unknown): v is CsChannel =>
  typeof v === "string" && (CS_CHANNELS as readonly string[]).includes(v);

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

/** Overall-average weighting between the Calls block and the Performance block (percent). */
export interface CsSplit {
  calls: number;
  performance: number;
}
export const DEFAULT_SPLIT: CsSplit = { calls: 50, performance: 50 };

export interface CsConfigShape {
  call: ValueMap;
  performance: ValueMap;
  split: CsSplit;
}
export const DEFAULT_CS_CONFIG: CsConfigShape = {
  call: { ...DEFAULT_VALUES },
  performance: { ...DEFAULT_VALUES },
  split: { ...DEFAULT_SPLIT },
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

function mergeSplit(raw: Partial<CsSplit> | undefined): CsSplit {
  return { calls: num(raw?.calls, DEFAULT_SPLIT.calls), performance: num(raw?.performance, DEFAULT_SPLIT.performance) };
}

/** Merge a stored (possibly partial) config over the defaults. Tolerant of junk. */
export function resolveCsConfig(
  raw?: { call?: Partial<ValueMap>; performance?: Partial<ValueMap>; split?: Partial<CsSplit> } | null,
): CsConfigShape {
  return { call: mergeMap(raw?.call), performance: mergeMap(raw?.performance), split: mergeSplit(raw?.split) };
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

/** Pick the Arabic variant in the `ar` locale when present, else the base text.
 *  Used for question titles/criteria/tags and evaluation-type names. */
export function localized(base: string, ar: string | null | undefined, locale: string): string {
  return locale === "ar" && ar ? ar : base;
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
 * Score as a % where a Perfect answer on every question = 100% (ceiling =
 * PERFECT value × Σ weights). NOT clamped: Outstanding pushes above 100% and
 * Catastrophe below 0%. A non-positive ceiling (no answers) yields 0.
 */
export function normalizedPct(answers: ScoredAnswer[], map: ValueMap): number {
  const best = map.PERFECT; // Perfect is the 100% mark; values run past 100% / below 0%
  const sumW = answers.reduce((s, a) => s + a.weight, 0);
  const ceiling = best * sumW;
  if (ceiling <= 0) return 0;
  const total = answers.reduce((s, a) => s + a.value * a.weight, 0);
  return round2((total / ceiling) * 100);
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
  can: (moduleKey: string, capability: string) => boolean;
}

/** Open the module — read-only (criteria + one's own evaluations). VIEW+. */
export const canAccessCs = (a: CsAccess): boolean => a.canModule(CS_MODULE, "VIEW");
/** Evaluate calls — cs_quality `operate` capability (default OPERATE). */
export const canEvaluateCalls = (a: CsAccess): boolean => a.can(CS_MODULE, "operate");
/** Evaluate performance + approve + manage criteria — cs_quality `manage` (default MANAGE). */
export const canManageCs = (a: CsAccess): boolean => a.can(CS_MODULE, "manage");
/** The evaluated population — members of the Sales team (pharmacists). */
export const isRep = (a: CsAccess): boolean => !!a.user?.teamKeys.includes(SALES_TEAM_KEY);

/** Days a creator may edit/delete their own evaluation after submitting it. */
export const CS_EDIT_WINDOW_DAYS = 14;

/** Edit/delete rights for one evaluation: admins anytime; the evaluator who
 *  created it within CS_EDIT_WINDOW_DAYS of submission (any status). */
export function canEditEvaluation(opts: { isAdmin: boolean; isEvaluator: boolean; createdAt: Date; now?: Date }): boolean {
  if (opts.isAdmin) return true;
  if (!opts.isEvaluator) return false;
  const days = ((opts.now ?? new Date()).getTime() - opts.createdAt.getTime()) / 86_400_000;
  return days >= 0 && days <= CS_EDIT_WINDOW_DAYS;
}

// ── Monthly overall average: a weighted composite ──────────────────────────────
// Calls block + Performance block (split, default 50/50). The Calls block is a
// weighted blend of each call TYPE's monthly average (weights live on the call
// type). Components with no evaluations this month drop out and the remaining
// weights renormalize to fill 100% (so a rep isn't punished for not being
// evaluated on something). All inputs are monthly, approved-only, unclamped.

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const normName = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export interface CompositeInput {
  callTypes: { name: string; weight: number }[]; // active call types + their weights
  callEvals: { typeName: string | null; normalized: number }[];
  perfEvals: { normalized: number }[];
  callsWeight: number; // split %, e.g. 50
  perfWeight: number; // split %, e.g. 50
}
export interface CompositeType {
  name: string;
  weight: number;
  avg: number | null; // null = no evals of this type this month
  count: number;
}
export interface CompositeResult {
  overall: number | null; // null = no evaluations at all this month
  callsBlock: number | null;
  perfBlock: number | null;
  callsCount: number; // # of call evaluations this month
  perfCount: number; // # of performance evaluations this month
  byType: CompositeType[];
}

/** Renormalized weighted mean over the present (non-null) components; if every
 *  present component has weight 0, falls back to an equal-weight mean. */
function blend(parts: { weight: number; value: number }[]): number | null {
  if (!parts.length) return null;
  const totalW = parts.reduce((s, p) => s + (p.weight > 0 ? p.weight : 0), 0);
  if (totalW > 0) return round2(parts.reduce((s, p) => s + ((p.weight > 0 ? p.weight : 0) / totalW) * p.value, 0));
  return round2(mean(parts.map((p) => p.value)));
}

/** The month's overall average as the weighted composite (see header). */
export function compositeOverall(input: CompositeInput): CompositeResult {
  const byType: CompositeType[] = input.callTypes.map((ct) => {
    const evs = input.callEvals.filter((e) => normName(e.typeName) === normName(ct.name));
    return { name: ct.name, weight: ct.weight, avg: evs.length ? round2(mean(evs.map((e) => e.normalized))) : null, count: evs.length };
  });
  const callsBlock = blend(byType.filter((t) => t.avg !== null).map((t) => ({ weight: t.weight, value: t.avg as number })));
  const perfBlock = input.perfEvals.length ? round2(mean(input.perfEvals.map((e) => e.normalized))) : null;
  const blocks: { weight: number; value: number }[] = [];
  if (callsBlock !== null) blocks.push({ weight: input.callsWeight, value: callsBlock });
  if (perfBlock !== null) blocks.push({ weight: input.perfWeight, value: perfBlock });
  return { overall: blend(blocks), callsBlock, perfBlock, callsCount: input.callEvals.length, perfCount: input.perfEvals.length, byType };
}

// ── Bonus ("bounce") ───────────────────────────────────────────────────────────
// Per-employee max bonus (EGP) × the tier % their monthly overall average earns.
// Tiers are ascending thresholds: the employee gets the highest tier whose
// `fromPct` they meet. Below the lowest threshold → 0%.

export interface BonusTier {
  fromPct: number; // overall-average threshold (inclusive)
  bonusPct: number; // % of max bonus (may exceed 100)
}

/** Sort tiers ascending by threshold (defensive). */
export function sortTiers(tiers: BonusTier[]): BonusTier[] {
  return [...tiers].sort((a, b) => a.fromPct - b.fromPct);
}

/** The bonus % for an overall average — the highest tier reached, else 0. */
export function bonusPctFor(overall: number | null, tiers: BonusTier[]): number {
  if (overall === null) return 0;
  let pct = 0;
  for (const t of sortTiers(tiers)) if (overall >= t.fromPct) pct = t.bonusPct;
  return pct;
}

/** Expected bonus (EGP) = maxBonus × tier% / 100, rounded to whole EGP. */
export function expectedBonus(overall: number | null, maxBonus: number, tiers: BonusTier[]): number {
  return Math.round((maxBonus * bonusPctFor(overall, tiers)) / 100);
}
