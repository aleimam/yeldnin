import "server-only";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret-box";
import { writeAudit } from "@/lib/audit";
import { adminUserIds } from "@/lib/notify/notify-service";
import { sendLocalizedCustomNotification } from "@/lib/notify/notify-message-service";
import {
  isBackupDue,
  backupFileName,
  prunableArchives,
  contentsList,
  clampHour,
  clampWeekday,
  clampDayOfMonth,
  clampPort,
  clampRetention,
  clampKeep,
  isBackupFrequency,
  isBackupProtocol,
  isTierContents,
  contentsToKind,
  clampEveryN,
  explainPathError,
  type BackupFrequency,
  type ArchiveKind,
} from "./backup-logic";

const KEY = "BACKUP";

/** The single config row, created (disabled) on first access. */
async function getRow() {
  const r = await prisma.backupConfig.findUnique({ where: { singleton: KEY } });
  if (r) return r;
  return prisma.backupConfig.create({ data: { singleton: KEY } });
}

export type TierRow = Awaited<ReturnType<typeof prisma.backupTier.findFirstOrThrow>>;

/** The three levels a fresh install starts with. An UPGRADE gets its tiers from
 *  the migration (seeded from the previous single schedule) instead. */
const DEFAULT_TIERS = [
  { key: "HOURLY", frequency: "HOURLY", contents: "DB", suffix: "/hourly", keepLast: 24, sortOrder: 1 },
  { key: "DAILY", frequency: "DAILY", contents: "FULL", suffix: "/daily", keepLast: 7, sortOrder: 2 },
  { key: "WEEKLY", frequency: "WEEKLY", contents: "FULL", suffix: "/weekly", keepLast: 8, sortOrder: 3 },
  // Operator-triggered only: frequency OFF is never DUE, so the scheduler skips
  // it and "Backup now" is the only thing that writes here. Keeping manual runs
  // out of the scheduled folders stops them consuming a scheduled retention slot.
  { key: "MANUAL", frequency: "OFF", contents: "FULL", suffix: "/manual", keepLast: 10, sortOrder: 4 },
];

/** The tier that operator-triggered ("Backup now") runs write to. */
export const MANUAL_TIER_KEY = "MANUAL";

/** All tiers in display order, seeding the defaults on first access. */
export async function listTiers(): Promise<TierRow[]> {
  const rows = await prisma.backupTier.findMany({ orderBy: { sortOrder: "asc" } });
  if (rows.length) return rows;
  const base = (await getRow()).remotePath.replace(/\/+$/, "");
  for (const { suffix, ...d } of DEFAULT_TIERS) {
    await prisma.backupTier.create({ data: { ...d, everyN: 1, hourUtc: 2, remotePath: `${base}${suffix}` } });
  }
  return prisma.backupTier.findMany({ orderBy: { sortOrder: "asc" } });
}

export interface BackupTierView {
  key: string;
  enabled: boolean;
  frequency: string;
  everyN: number;
  hourUtc: number;
  weekday: number;
  dayOfMonth: number;
  contents: string;
  remotePath: string;
  keepLast: number;
  lastRunAt: string | null;
}

export interface SaveTierInput {
  key: string;
  enabled: boolean;
  frequency: string;
  everyN?: number | null;
  hourUtc?: number | null;
  weekday?: number | null;
  dayOfMonth?: number | null;
  contents: string;
  remotePath?: string | null;
  keepLast?: number | null;
}

/** Update the tiers. Only KNOWN keys are touched — client input can never
 *  create or delete a tier. */
export async function saveTiers(inputs: SaveTierInput[], userId: number): Promise<void> {
  const existing = await listTiers();
  for (const input of inputs) {
    const cur = existing.find((t) => t.key === input.key);
    if (!cur) continue;
    await prisma.backupTier.update({
      where: { id: cur.id },
      data: {
        enabled: input.enabled,
        frequency: isBackupFrequency(input.frequency) ? input.frequency : cur.frequency,
        everyN: clampEveryN(input.everyN),
        hourUtc: clampHour(input.hourUtc),
        weekday: clampWeekday(input.weekday),
        dayOfMonth: clampDayOfMonth(input.dayOfMonth),
        contents: isTierContents(input.contents) ? input.contents : cur.contents,
        remotePath: clean(input.remotePath) || cur.remotePath,
        keepLast: clampKeep(input.keepLast, cur.keepLast),
      },
    });
  }
  await writeAudit(userId, "settings", "backup.tiers.save", "backupTier", KEY);
}

/**
 * Run ONE tier immediately, whatever its schedule says. Used both by "Backup
 * now" (which targets the MANUAL tier) and by each level's own "Run now", so a
 * single level can be exercised deliberately without waiting for its slot.
 * `enabled` gates SCHEDULING only — an explicit request always runs.
 */
export async function runTierNow(
  userId: number | null,
  key: string,
): Promise<{ ok: boolean; tier: string; fileName?: string; error?: string }> {
  const tier = (await listTiers()).find((t) => t.key === key);
  if (!tier) return { ok: false, tier: key, error: `Unknown backup level "${key}".` };
  const r = await runBackup("MANUAL", userId, tier);
  return { ok: r.ok, tier: tier.key, fileName: r.fileName, error: r.error };
}

export interface BackupConfigView {
  enabled: boolean;
  protocol: string;
  host: string | null;
  port: number;
  username: string | null;
  hasPassword: boolean; // the password itself is never sent to the client
  remotePath: string;
  secure: boolean;
  includeDb: boolean;
  includeUploads: boolean;
  frequency: string;
  hourUtc: number;
  weekday: number;
  dayOfMonth: number;
  retentionKeep: number;
  tiered: boolean;
  keepHourly: number;
  keepDaily: number;
  keepWeekly: number;
  notifyOnFailure: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  lastRunAt: string | null;
}

export interface BackupRunView {
  id: number;
  tierKey: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  trigger: string;
  contents: string;
  fileName: string | null;
  sizeBytes: number | null;
  error: string | null;
}

/** Browser-safe projection of the config + recent run history. No secrets. */
export async function backupView(): Promise<{
  config: BackupConfigView;
  tiers: BackupTierView[];
  runs: BackupRunView[];
}> {
  const [r, tiers, runs] = await Promise.all([
    getRow(),
    listTiers(),
    prisma.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
  ]);
  return {
    tiers: tiers.map((t) => ({
      key: t.key,
      enabled: t.enabled,
      frequency: t.frequency,
      everyN: t.everyN,
      hourUtc: t.hourUtc,
      weekday: t.weekday,
      dayOfMonth: t.dayOfMonth,
      contents: t.contents,
      remotePath: t.remotePath,
      keepLast: t.keepLast,
      lastRunAt: t.lastRunAt?.toISOString() ?? null,
    })),
    config: {
      enabled: r.enabled,
      protocol: r.protocol,
      host: r.host,
      port: r.port,
      username: r.username,
      hasPassword: !!r.passwordEnc,
      remotePath: r.remotePath,
      secure: r.secure,
      includeDb: r.includeDb,
      includeUploads: r.includeUploads,
      frequency: r.frequency,
      hourUtc: r.hourUtc,
      weekday: r.weekday,
      dayOfMonth: r.dayOfMonth,
      retentionKeep: r.retentionKeep,
      tiered: r.tiered,
      keepHourly: r.keepHourly,
      keepDaily: r.keepDaily,
      keepWeekly: r.keepWeekly,
      notifyOnFailure: r.notifyOnFailure,
      lastTestAt: r.lastTestAt?.toISOString() ?? null,
      lastTestOk: r.lastTestOk,
      lastTestMessage: r.lastTestMessage,
      lastRunAt: r.lastRunAt?.toISOString() ?? null,
    },
    runs: runs.map((x) => ({
      id: x.id,
      tierKey: x.tierKey,
      startedAt: x.startedAt.toISOString(),
      finishedAt: x.finishedAt?.toISOString() ?? null,
      status: x.status,
      trigger: x.trigger,
      contents: x.contents,
      fileName: x.fileName,
      sizeBytes: x.sizeBytes,
      error: x.error,
    })),
  };
}

export interface SaveBackupInput {
  enabled: boolean;
  protocol: string;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  /** New password. Empty/undefined = keep the stored one unchanged. */
  password?: string | null;
  remotePath?: string | null;
  secure: boolean;
  includeDb: boolean;
  includeUploads: boolean;
  frequency: string;
  hourUtc?: number | null;
  weekday?: number | null;
  dayOfMonth?: number | null;
  retentionKeep?: number | null;
  tiered: boolean;
  keepHourly?: number | null;
  keepDaily?: number | null;
  keepWeekly?: number | null;
  notifyOnFailure: boolean;
}

/** Save config. Password is encrypted at rest and only replaced when non-empty. */
export async function saveBackupConfig(input: SaveBackupInput, userId: number): Promise<void> {
  const current = await getRow();
  const pwd = input.password?.trim();
  const frequency: BackupFrequency = isBackupFrequency(input.frequency) ? input.frequency : "DAILY";
  await prisma.backupConfig.update({
    where: { singleton: KEY },
    data: {
      enabled: input.enabled,
      // An unknown/absent protocol KEEPS the stored one. Defaulting to FTPS here
      // meant a stale browser tab (whose form predates the protocol selector and
      // so omits the field) silently downgraded a working SFTP config on save.
      protocol: isBackupProtocol(input.protocol) ? input.protocol : current.protocol,
      host: clean(input.host),
      port: clampPort(input.port),
      username: clean(input.username),
      ...(pwd ? { passwordEnc: encryptSecret(pwd) } : {}),
      remotePath: clean(input.remotePath) || "/",
      secure: input.secure,
      includeDb: input.includeDb,
      includeUploads: input.includeUploads,
      frequency,
      hourUtc: clampHour(input.hourUtc),
      weekday: clampWeekday(input.weekday),
      dayOfMonth: clampDayOfMonth(input.dayOfMonth),
      retentionKeep: clampRetention(input.retentionKeep),
      // Same rule as `protocol`: a client that doesn't send these (a stale tab
      // predating the tiering UI) must not reset them — fall back to STORED.
      tiered: typeof input.tiered === "boolean" ? input.tiered : current.tiered,
      keepHourly: clampKeep(input.keepHourly, current.keepHourly),
      keepDaily: clampKeep(input.keepDaily, current.keepDaily),
      keepWeekly: clampKeep(input.keepWeekly, current.keepWeekly),
      notifyOnFailure: input.notifyOnFailure,
      updatedById: userId,
    },
  });
  await writeAudit(userId, "settings", "backup.save", "backupConfig", KEY);
}

// ── Remote transports (basic-ftp / ssh2-sftp-client are pure-JS and loaded
// lazily so neither ever enters a non-nodejs bundle) ─────────────────────────
type Row = Awaited<ReturnType<typeof getRow>>;

/** The remote operations a backup destination must support. `dir` is always the
 *  configured absolute remote folder; each transport adapts to its own client. */
type Transport = {
  /** The directory the account lands in — i.e. what it may actually write to.
   *  Used to turn a bare "permission denied" into an actionable message. */
  homeDir: string | null;
  ensureDir(dir: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  upload(localPath: string, dir: string, fileName: string): Promise<void>;
  remove(dir: string, fileName: string): Promise<void>;
};

const remoteJoin = (dir: string, name: string) => `${(dir || "/").replace(/\/+$/, "")}/${name}`;

/** FTPS. NOTE: basic-ftp is cwd-based, so every op re-enters the directory.
 *  `ensureDir` also CREATES it when missing (long-standing behaviour). */
async function withFtps<T>(cfg: Row, password: string, fn: (t: Transport) => Promise<T>): Promise<T> {
  const { Client } = await import("basic-ftp");
  const client = new Client(30_000);
  try {
    await client.access({ host: cfg.host!, port: cfg.port, user: cfg.username!, password, secure: cfg.secure });
    const homeDir = await client.pwd().catch(() => null);
    const enter = (dir: string) => client.ensureDir(dir || "/");
    return await fn({
      homeDir,
      ensureDir: enter,
      list: async (dir) => {
        await enter(dir);
        return (await client.list()).map((f) => f.name);
      },
      upload: async (localPath, dir, fileName) => {
        await enter(dir);
        await client.uploadFrom(localPath, fileName);
      },
      remove: async (dir, fileName) => {
        await enter(dir);
        await client.remove(fileName);
      },
    });
  } finally {
    client.close();
  }
}

/** SFTP over SSH — a single connection, so no passive data channel to be blocked
 *  by an outbound firewall. Paths are absolute; no cwd to maintain. */
async function withSftp<T>(cfg: Row, password: string, fn: (t: Transport) => Promise<T>): Promise<T> {
  const { default: SftpClient } = await import("ssh2-sftp-client");
  const client = new SftpClient();
  try {
    await client.connect({
      host: cfg.host!,
      port: cfg.port,
      username: cfg.username!,
      password,
      readyTimeout: 30_000,
    });
    const homeDir = await client.cwd().catch(() => null);
    return await fn({
      homeDir,
      ensureDir: async (dir) => {
        const d = dir || "/";
        if (!(await client.exists(d))) await client.mkdir(d, true);
      },
      list: async (dir) => (await client.list(dir || "/")).map((f) => f.name),
      upload: async (localPath, dir, fileName) => {
        await client.fastPut(localPath, remoteJoin(dir, fileName));
      },
      remove: async (dir, fileName) => {
        await client.delete(remoteJoin(dir, fileName));
      },
    });
  } finally {
    await client.end().catch(() => {});
  }
}

/** Open the configured destination and run `fn` against it. */
async function withTransport<T>(cfg: Row, fn: (t: Transport) => Promise<T>): Promise<T> {
  const password = decryptSecret(cfg.passwordEnc);
  if (!cfg.host || !cfg.username || !password) throw new Error("Enter host, username and password first.");
  const open = cfg.protocol === "SFTP" ? withSftp : withFtps;
  return open(cfg, password, async (t) => {
    try {
      return await fn(t);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(explainPathError(msg, t.homeDir));
    }
  });
}

/** Validate the FTPS credentials by connecting and listing the target dir. */
export async function testBackupConnection(userId: number): Promise<{ ok: boolean; message: string }> {
  const cfg = await getRow();
  let ok = false;
  let message = "";
  try {
    message = await withTransport(cfg, async (t) => {
      const dir = cfg.remotePath || "/";
      await t.ensureDir(dir);
      const list = await t.list(dir);
      ok = true;
      return `Connected over ${cfg.protocol} — ${list.length} item(s) in ${dir}.`;
    });
  } catch (e) {
    ok = false;
    message = e instanceof Error ? e.message : "Connection failed.";
  }
  await prisma.backupConfig.update({
    where: { singleton: KEY },
    data: { lastTestAt: new Date(), lastTestOk: ok, lastTestMessage: message.slice(0, 300), updatedById: userId },
  });
  await writeAudit(userId, "settings", "backup.test", "backupConfig", KEY, { ok });
  return { ok, message };
}

/** A consistent SQLite snapshot via `VACUUM INTO` (safe under WAL) → dest path. */
async function snapshotDb(dest: string): Promise<void> {
  const dbFile = path.join(process.cwd(), "prisma", "dev.db");
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(dbFile);
  try {
    db.exec("PRAGMA busy_timeout = 10000;"); // wait out the live app's WAL writes
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Stage selected parts and produce a .tar.gz at `archivePath`. Returns the parts. */
async function buildArchive(kind: ArchiveKind, tmpDir: string, archivePath: string): Promise<string[]> {
  const stage = path.join(tmpDir, "stage");
  await fs.mkdir(stage, { recursive: true });
  const entries: string[] = [];
  // The tier's `contents` decides: a `db` archive deliberately omits uploads —
  // that is the point of the cheap frequent tier (uploads are ~10x the database
  // once compressed, and barely change).
  const withUploads = kind === "full";

  {
    await snapshotDb(path.join(stage, "dev.db"));
    entries.push("dev.db");
  }
  if (withUploads) {
    const src = path.join(process.cwd(), "uploads");
    if (await pathExists(src)) {
      await fs.cp(src, path.join(stage, "uploads"), { recursive: true });
      entries.push("uploads");
    }
  }
  // The manifest must describe what this archive ACTUALLY holds, not what the
  // config asks for in general — a db-only archive must not claim uploads.
  const actual = contentsList({ includeDb: true, includeUploads: withUploads });
  await fs.writeFile(
    path.join(stage, "manifest.json"),
    JSON.stringify({ app: "YeldnIN", kind, createdAt: new Date().toISOString(), contents: actual }, null, 2),
  );
  entries.push("manifest.json");

  if (entries.length === 1) throw new Error("Nothing selected to back up — enable the database and/or uploads.");

  const tar = await import("tar");
  await tar.create({ gzip: true, cwd: stage, file: archivePath }, entries);
  return actual;
}

/** Upload the archive to the configured destination and prune old archives per
 *  the retention policy. */
async function uploadAndPrune(cfg: Row, tier: TierRow, archivePath: string, fileName: string): Promise<void> {
  await withTransport(cfg, async (t) => {
    const dir = tier.remotePath || "/";
    await t.ensureDir(dir); // created when missing
    await t.upload(archivePath, dir, fileName);
    // Each tier owns its folder, so retention is simply keep-newest-N in it —
    // no cross-tier reasoning, and a foreign file is never a candidate.
    const stale = prunableArchives(await t.list(dir), tier.keepLast);
    // Deleting real backups — say what went, so pm2 logs can be audited after.
    if (stale.length) console.log(`[backup] ${tier.key}: pruning ${stale.length} in ${dir}: ${stale.join(", ")}`);
    for (const name of stale) await t.remove(dir, name).catch(() => {});
  });
}

async function notifyFailure(message: string): Promise<void> {
  const ids = await adminUserIds();
  if (!ids.length) return;
  await sendLocalizedCustomNotification(
    ids,
    "backup.notif.failedTitle",
    "backup.notif.failedBody",
    { error: message.slice(0, 140) },
    "/settings/backup",
    "error",
    0, // system actor — no user to skip
  ).catch(() => {});
}

/** Run a backup now: snapshot → archive → upload → prune. Records a BackupRun and
 *  notifies admins on failure. Never throws — returns the outcome. */
export async function runBackup(
  trigger: "MANUAL" | "SCHEDULED",
  userId: number | null,
  tier: TierRow,
): Promise<{ ok: boolean; runId: number; fileName?: string; sizeBytes?: number; error?: string }> {
  const cfg = await getRow();
  const startedAt = new Date();
  const kind = contentsToKind(tier.contents);
  const run = await prisma.backupRun.create({
    data: {
      tierKey: tier.key,
      trigger,
      status: "RUNNING",
      contents: contentsList({ includeDb: true, includeUploads: kind === "full" }).join(","),
      byUserId: userId ?? undefined,
    },
  });
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "yeldnin-backup-"));
  try {
    const fileName = backupFileName(startedAt, kind);
    const archivePath = path.join(tmpDir, fileName);
    await buildArchive(kind, tmpDir, archivePath);
    const sizeBytes = (await fs.stat(archivePath)).size;
    await uploadAndPrune(cfg, tier, archivePath, fileName);
    await prisma.backupRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), fileName, sizeBytes },
    });
    // Each tier tracks its OWN last run — that is what keeps the cadences
    // independent of one another.
    await prisma.backupTier.update({ where: { id: tier.id }, data: { lastRunAt: startedAt } });
    await prisma.backupConfig.update({ where: { singleton: KEY }, data: { lastRunAt: new Date() } });
    if (userId != null) await writeAudit(userId, "settings", "backup.run", "backupRun", run.id, { trigger, tier: tier.key, fileName, sizeBytes });
    return { ok: true, runId: run.id, fileName, sizeBytes };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Backup failed.";
    await prisma.backupRun
      .update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), error: error.slice(0, 500) } })
      .catch(() => {});
    if (cfg.notifyOnFailure) await notifyFailure(`${tier.key}: ${error}`);
    return { ok: false, runId: run.id, error };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Cron entrypoint: run EVERY tier whose own schedule is due. Tiers are
 *  independent, so one failing (or being off) never blocks the others. */
export async function maybeRunScheduledBackup(): Promise<{
  ran: boolean;
  skipped?: boolean;
  results?: Array<{ tier: string; status: string }>;
}> {
  const cfg = await getRow();
  if (!cfg.enabled) return { ran: false, skipped: true };
  const now = new Date();
  const results: Array<{ tier: string; status: string }> = [];
  for (const tier of await listTiers()) {
    if (!tier.enabled) continue;
    const due = isBackupDue(
      {
        frequency: tier.frequency as BackupFrequency,
        everyN: tier.everyN,
        hourUtc: tier.hourUtc,
        weekday: tier.weekday,
        dayOfMonth: tier.dayOfMonth,
      },
      tier.lastRunAt,
      now,
    );
    if (!due) continue;
    const res = await runBackup("SCHEDULED", null, tier);
    results.push({ tier: tier.key, status: res.ok ? "SUCCESS" : "FAILED" });
  }
  return results.length ? { ran: true, results } : { ran: false };
}
