// Pure backup scheduling + archive-naming logic. No DB/IO. Unit-tested.

export const BACKUP_FREQUENCIES = ["OFF", "HOURLY", "DAILY", "WEEKLY", "MONTHLY"] as const;
export type BackupFrequency = (typeof BACKUP_FREQUENCIES)[number];

export const BACKUP_PROTOCOLS = ["FTPS", "SFTP"] as const;
export type BackupProtocol = (typeof BACKUP_PROTOCOLS)[number];

export function isBackupProtocol(v: unknown): v is BackupProtocol {
  return typeof v === "string" && (BACKUP_PROTOCOLS as readonly string[]).includes(v);
}

/**
 * Conventional port per protocol — FTPS 21, SFTP 22. Only a UI default: some
 * hosts differ (a Hetzner Storage Box serves SSH/SFTP on **23**), so the field
 * stays editable.
 *
 * Prefer SFTP where possible: it moves data over the SAME connection, whereas
 * FTPS opens a second "passive" connection on a random high port — which a
 * restrictive outbound firewall blocks, and which the kernel's FTP conntrack
 * helper cannot rescue because TLS hides the control channel.
 */
export const defaultPortFor = (p: BackupProtocol): number => (p === "SFTP" ? 22 : 21);

/** Archive filename prefix — how we recognise (and prune) our own files remotely. */
export const ARCHIVE_PREFIX = "yeldnin-backup-";

export function isBackupFrequency(v: unknown): v is BackupFrequency {
  return typeof v === "string" && (BACKUP_FREQUENCIES as readonly string[]).includes(v);
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}
export const clampHour = (n: unknown) => clampInt(n, 0, 23, 2);
export const clampWeekday = (n: unknown) => clampInt(n, 0, 6, 1);
export const clampDayOfMonth = (n: unknown) => clampInt(n, 1, 28, 1);
export const clampPort = (n: unknown) => clampInt(n, 1, 65535, 21);
export const clampRetention = (n: unknown) => clampInt(n, 0, 3650, 30);
/** A per-tier "keep last N". 0 disables that tier; capped so a typo can't ask
 *  for an absurd history. Each tier carries its own sensible default. */
export const clampKeep = (n: unknown, fallback: number) => clampInt(n, 0, 1000, fallback);

export interface Schedule {
  frequency: BackupFrequency;
  hourUtc: number;
  weekday: number; // 0=Sun..6=Sat
  dayOfMonth: number; // 1..28
}

const DAY_MS = 86_400_000;

/**
 * The most recent moment the schedule should have fired at or before `now` (all
 * UTC), or null when the schedule is OFF. Used to decide whether a run is overdue.
 */
export function lastScheduledFireTime(s: Schedule, now: Date): Date | null {
  if (s.frequency === "OFF") return null;
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();

  if (s.frequency === "HOURLY") {
    return new Date(Date.UTC(y, mo, d, now.getUTCHours(), 0, 0, 0));
  }
  if (s.frequency === "DAILY") {
    const today = new Date(Date.UTC(y, mo, d, s.hourUtc, 0, 0, 0));
    return now.getTime() >= today.getTime() ? today : new Date(today.getTime() - DAY_MS);
  }
  if (s.frequency === "WEEKLY") {
    const todayAt = new Date(Date.UTC(y, mo, d, s.hourUtc, 0, 0, 0));
    const backDays = (now.getUTCDay() - s.weekday + 7) % 7; // days since the target weekday
    let fire = new Date(todayAt.getTime() - backDays * DAY_MS);
    if (fire.getTime() > now.getTime()) fire = new Date(fire.getTime() - 7 * DAY_MS);
    return fire;
  }
  // MONTHLY (dayOfMonth capped at 28 so every month has it)
  const dom = Math.min(Math.max(s.dayOfMonth, 1), 28);
  const thisMonth = new Date(Date.UTC(y, mo, dom, s.hourUtc, 0, 0, 0));
  if (thisMonth.getTime() <= now.getTime()) return thisMonth;
  return new Date(Date.UTC(y, mo - 1, dom, s.hourUtc, 0, 0, 0));
}

/** Should a backup run now? True when the schedule has fired since the last run. */
export function isBackupDue(s: Schedule, lastRunAt: Date | null, now: Date): boolean {
  const fire = lastScheduledFireTime(s, now);
  if (!fire) return false;
  return lastRunAt == null || lastRunAt.getTime() < fire.getTime();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** What an archive contains. `db` = database only (the cheap hourly snapshot);
 *  `full` = database + uploads. */
export const ARCHIVE_KINDS = ["db", "full"] as const;
export type ArchiveKind = (typeof ARCHIVE_KINDS)[number];

/** Timestamped archive filename in UTC:
 *  `yeldnin-backup-<kind>-YYYYMMDD-HHmmss.tar.gz`. */
export function backupFileName(now: Date, kind: ArchiveKind = "full"): string {
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `${ARCHIVE_PREFIX}${kind}-${stamp}.tar.gz`;
}

const STAMP = String.raw`(\d{8})-(\d{6})`;
const KINDED = new RegExp(`^${ARCHIVE_PREFIX}(db|full)-${STAMP}\\.tar\\.gz$`);
const LEGACY = new RegExp(`^${ARCHIVE_PREFIX}${STAMP}\\.tar\\.gz$`);

function stampToDate(ymd: string, hms: string): Date | null {
  const d = new Date(
    Date.UTC(
      Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)),
      Number(hms.slice(0, 2)), Number(hms.slice(2, 4)), Number(hms.slice(4, 6)),
    ),
  );
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Recognise one of OUR archives and read its kind + timestamp. Returns null for
 * anything else — foreign files in the backup folder must never be considered
 * for deletion. Archives written before the kind segment existed are `full`
 * (they contained whatever the config said, but they are the daily-tier lineage).
 */
export function parseArchiveName(name: string): { kind: ArchiveKind; at: Date } | null {
  const k = KINDED.exec(name);
  if (k) {
    const at = stampToDate(k[2], k[3]);
    return at ? { kind: k[1] as ArchiveKind, at } : null;
  }
  const l = LEGACY.exec(name);
  if (l) {
    const at = stampToDate(l[1], l[2]);
    return at ? { kind: "full", at } : null;
  }
  return null;
}

/** Our archive files within a remote listing, newest-first (by TIMESTAMP — with
 *  a kind segment in the name, lexical order is no longer chronological). */
export function ourArchives(names: string[]): string[] {
  return names
    .map((n) => ({ n, p: parseArchiveName(n) }))
    .filter((x): x is { n: string; p: { kind: ArchiveKind; at: Date } } => x.p !== null)
    .sort((a, b) => b.p.at.getTime() - a.p.at.getTime())
    .map((x) => x.n);
}

/** Which remote files to delete to keep only the newest `keep` (keep<=0 → none). */
export function prunableArchives(names: string[], keep: number): string[] {
  if (keep <= 0) return [];
  return ourArchives(names).slice(keep);
}

export interface RetentionPolicy {
  /** db-only archives to keep (the last N hours). */
  keepHourly: number;
  /** newest full archives to keep (the last N days, one full per day). */
  keepDaily: number;
  /** additional full archives, one per 7-day bucket, beyond the daily window. */
  keepWeekly: number;
}

/** 7-day bucket id. Deliberately epoch-based rather than calendar ISO weeks —
 *  retention only needs "one per week", and this has no year-boundary edges. */
const weekBucket = (d: Date) => Math.floor(d.getTime() / (7 * DAY_MS));

/**
 * Tiered (grandfather-father-son) retention: which archives to DELETE.
 *
 *  - `db` archives: keep the newest `keepHourly`.
 *  - `full` archives: keep the newest `keepDaily`, then walking older, keep the
 *    newest survivor in each distinct week until `keepWeekly` weeks are held.
 *
 * Safety properties (unit-tested, because this deletes real backups):
 *  - files we cannot parse are NEVER returned;
 *  - the single most recent archive is NEVER returned, whatever the policy says.
 */
export function tieredPrunable(names: string[], p: RetentionPolicy): string[] {
  const parsed = names
    .map((n) => ({ n, p: parseArchiveName(n) }))
    .filter((x): x is { n: string; p: { kind: ArchiveKind; at: Date } } => x.p !== null);
  if (!parsed.length) return [];

  const newestFirst = [...parsed].sort((a, b) => b.p.at.getTime() - a.p.at.getTime());
  const newestOverall = newestFirst[0].n;
  const doomed: string[] = [];

  const db = newestFirst.filter((x) => x.p.kind === "db");
  doomed.push(...db.slice(Math.max(0, p.keepHourly)).map((x) => x.n));

  const full = newestFirst.filter((x) => x.p.kind === "full");
  const weeks = new Set<number>();
  for (const a of full.slice(Math.max(0, p.keepDaily))) {
    const w = weekBucket(a.p.at);
    if (weeks.size < Math.max(0, p.keepWeekly) && !weeks.has(w)) {
      weeks.add(w); // this one represents its week — keep it
      continue;
    }
    doomed.push(a.n);
  }

  // Belt and braces: a mis-set policy (all zeros) must not wipe the newest copy.
  return doomed.filter((n) => n !== newestOverall);
}

/**
 * What this run should contain. Under tiered retention a FULL archive is taken
 * at `hourUtc`; every other hour is db-only. A full is also forced when none has
 * been taken for over a day, so a missed slot (app down at `hourUtc`) doesn't
 * silently cost a whole day's uploads.
 */
export function archiveKindFor(
  cfg: { tiered: boolean; hourUtc: number },
  lastFullAt: Date | null,
  now: Date,
): ArchiveKind {
  if (!cfg.tiered) return "full";
  if (now.getUTCHours() === cfg.hourUtc) return "full";
  if (!lastFullAt) return "full";
  return now.getTime() - lastFullAt.getTime() >= 25 * 3_600_000 ? "full" : "db";
}

/**
 * Turn a bare remote path error into an actionable one. Servers answer a path
 * outside the account's home with just "permission denied" / "Bad path", never
 * saying what IS writable — e.g. a Hetzner Storage Box lands you in `/home` and
 * refuses `/backup/...` because `/` is not yours. Appending the real home turns
 * a dead end into an obvious fix. Non-path errors pass through untouched. PURE.
 */
export function explainPathError(message: string, homeDir: string | null): string {
  if (!homeDir) return message;
  if (!/permission denied|bad path|no such file|denied|not found/i.test(message)) return message;
  // Strip the trailing slash so a home of "/" yields "/backup", not "//backup".
  const home = homeDir.replace(/\/+$/, "");
  return `${message} — this account can only write inside "${homeDir}", so the remote folder must start with it (e.g. "${home}/backup").`;
}

/** The included parts as a stable csv list, e.g. ["db","uploads"]. */
export function contentsList(c: { includeDb: boolean; includeUploads: boolean }): string[] {
  const out: string[] = [];
  if (c.includeDb) out.push("db");
  if (c.includeUploads) out.push("uploads");
  return out;
}

/** Human file size (used in the run log). */
export function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
