// Pure Documents logic. No DB/IO. Unit-tested.

export const DOC_KINDS = ["PDF", "DOC"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export function isDocKind(v: unknown): v is DocKind {
  return typeof v === "string" && (DOC_KINDS as readonly string[]).includes(v);
}

export const DOC_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];
export function isDocStatus(v: unknown): v is DocStatus {
  return typeof v === "string" && (DOC_STATUSES as readonly string[]).includes(v);
}

// Per-document access. NONE = no access; VIEW/OPERATE/MANAGE are the grantable levels.
export const DOC_LEVELS = ["NONE", "VIEW", "OPERATE", "MANAGE"] as const;
export type DocLevel = (typeof DOC_LEVELS)[number];
export const GRANT_LEVELS = ["VIEW", "OPERATE", "MANAGE"] as const;
export function isGrantLevel(v: unknown): v is "VIEW" | "OPERATE" | "MANAGE" {
  return typeof v === "string" && (GRANT_LEVELS as readonly string[]).includes(v);
}

const RANK: Record<DocLevel, number> = { NONE: 0, VIEW: 1, OPERATE: 2, MANAGE: 3 };
export function levelMeets(have: DocLevel, min: DocLevel): boolean {
  return RANK[have] >= RANK[min];
}

/**
 * The level a user has on a document. Admins and the owner always get MANAGE;
 * otherwise the highest grant among permissions for teams the user belongs to.
 */
export function documentAccessLevel(opts: {
  isAdmin: boolean;
  isOwner: boolean;
  userTeamKeys: string[];
  perms: { teamKey: string; level: string }[];
}): DocLevel {
  if (opts.isAdmin || opts.isOwner) return "MANAGE";
  const teams = new Set(opts.userTeamKeys);
  let best: DocLevel = "NONE";
  for (const p of opts.perms) {
    if (teams.has(p.teamKey) && isGrantLevel(p.level) && RANK[p.level] > RANK[best]) best = p.level;
  }
  return best;
}

/** Can the user see this document at all? Needs ≥ VIEW; a DRAFT is visible only to
 *  OPERATE+ (owner/admin/operate/manage) — View-only users don't see drafts. */
export function canViewDocument(status: string, level: DocLevel): boolean {
  if (level === "NONE") return false;
  return status === "DRAFT" ? RANK[level] >= RANK.OPERATE : true;
}

/** Operate+ may edit a DOC's content (and replace a PDF's file). */
export function canEditContent(level: DocLevel): boolean {
  return RANK[level] >= RANK.OPERATE;
}

/** Manage may edit metadata, status, permissions, rename and delete. */
export function canManageDocument(level: DocLevel): boolean {
  return level === "MANAGE";
}
