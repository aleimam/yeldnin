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
  isBackupFrequency,
  type BackupFrequency,
} from "./backup-logic";

const KEY = "BACKUP";

/** The single config row, created (disabled) on first access. */
async function getRow() {
  const r = await prisma.backupConfig.findUnique({ where: { singleton: KEY } });
  if (r) return r;
  return prisma.backupConfig.create({ data: { singleton: KEY } });
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
  notifyOnFailure: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  lastRunAt: string | null;
}

export interface BackupRunView {
  id: number;
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
export async function backupView(): Promise<{ config: BackupConfigView; runs: BackupRunView[] }> {
  const [r, runs] = await Promise.all([
    getRow(),
    prisma.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
  ]);
  return {
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
      notifyOnFailure: r.notifyOnFailure,
      lastTestAt: r.lastTestAt?.toISOString() ?? null,
      lastTestOk: r.lastTestOk,
      lastTestMessage: r.lastTestMessage,
      lastRunAt: r.lastRunAt?.toISOString() ?? null,
    },
    runs: runs.map((x) => ({
      id: x.id,
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
  notifyOnFailure: boolean;
}

/** Save config. Password is encrypted at rest and only replaced when non-empty. */
export async function saveBackupConfig(input: SaveBackupInput, userId: number): Promise<void> {
  await getRow();
  const pwd = input.password?.trim();
  const frequency: BackupFrequency = isBackupFrequency(input.frequency) ? input.frequency : "DAILY";
  await prisma.backupConfig.update({
    where: { singleton: KEY },
    data: {
      enabled: input.enabled,
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
      notifyOnFailure: input.notifyOnFailure,
      updatedById: userId,
    },
  });
  await writeAudit(userId, "settings", "backup.save", "backupConfig", KEY);
}

// ── FTPS transport (basic-ftp is pure-JS; loaded lazily so it never enters a
// non-nodejs bundle) ─────────────────────────────────────────────────────────
type Row = Awaited<ReturnType<typeof getRow>>;

async function withFtps<T>(cfg: Row, fn: (client: import("basic-ftp").Client) => Promise<T>): Promise<T> {
  const password = decryptSecret(cfg.passwordEnc);
  if (!cfg.host || !cfg.username || !password) throw new Error("Enter host, username and password first.");
  const { Client } = await import("basic-ftp");
  const client = new Client(30_000);
  try {
    await client.access({ host: cfg.host, port: cfg.port, user: cfg.username, password, secure: cfg.secure });
    return await fn(client);
  } finally {
    client.close();
  }
}

/** Validate the FTPS credentials by connecting and listing the target dir. */
export async function testBackupConnection(userId: number): Promise<{ ok: boolean; message: string }> {
  const cfg = await getRow();
  let ok = false;
  let message = "";
  try {
    message = await withFtps(cfg, async (client) => {
      await client.ensureDir(cfg.remotePath || "/");
      const list = await client.list();
      ok = true;
      return `Connected — ${list.length} item(s) in ${cfg.remotePath || "/"}.`;
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
async function buildArchive(cfg: Row, tmpDir: string, archivePath: string): Promise<string[]> {
  const stage = path.join(tmpDir, "stage");
  await fs.mkdir(stage, { recursive: true });
  const entries: string[] = [];

  if (cfg.includeDb) {
    await snapshotDb(path.join(stage, "dev.db"));
    entries.push("dev.db");
  }
  if (cfg.includeUploads) {
    const src = path.join(process.cwd(), "uploads");
    if (await pathExists(src)) {
      await fs.cp(src, path.join(stage, "uploads"), { recursive: true });
      entries.push("uploads");
    }
  }
  await fs.writeFile(
    path.join(stage, "manifest.json"),
    JSON.stringify({ app: "YeldnIN", createdAt: new Date().toISOString(), contents: contentsList(cfg) }, null, 2),
  );
  entries.push("manifest.json");

  if (entries.length === 1) throw new Error("Nothing selected to back up — enable the database and/or uploads.");

  const tar = await import("tar");
  await tar.create({ gzip: true, cwd: stage, file: archivePath }, entries);
  return contentsList(cfg);
}

/** Upload the archive over FTPS and prune old archives per the retention policy. */
async function uploadAndPrune(cfg: Row, archivePath: string, fileName: string): Promise<void> {
  await withFtps(cfg, async (client) => {
    await client.ensureDir(cfg.remotePath || "/"); // navigates cwd into the dir, creating it
    await client.uploadFrom(archivePath, fileName);
    if (cfg.retentionKeep > 0) {
      const list = await client.list();
      for (const stale of prunableArchives(list.map((f) => f.name), cfg.retentionKeep)) {
        await client.remove(stale).catch(() => {});
      }
    }
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
): Promise<{ ok: boolean; runId: number; fileName?: string; sizeBytes?: number; error?: string }> {
  const cfg = await getRow();
  const run = await prisma.backupRun.create({
    data: { trigger, status: "RUNNING", contents: contentsList(cfg).join(","), byUserId: userId ?? undefined },
  });
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "yeldnin-backup-"));
  try {
    const fileName = backupFileName(new Date());
    const archivePath = path.join(tmpDir, fileName);
    await buildArchive(cfg, tmpDir, archivePath);
    const sizeBytes = (await fs.stat(archivePath)).size;
    await uploadAndPrune(cfg, archivePath, fileName);
    await prisma.backupRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), fileName, sizeBytes },
    });
    await prisma.backupConfig.update({ where: { singleton: KEY }, data: { lastRunAt: new Date() } });
    if (userId != null) await writeAudit(userId, "settings", "backup.run", "backupRun", run.id, { trigger, fileName, sizeBytes });
    return { ok: true, runId: run.id, fileName, sizeBytes };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Backup failed.";
    await prisma.backupRun
      .update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), error: error.slice(0, 500) } })
      .catch(() => {});
    if (cfg.notifyOnFailure) await notifyFailure(error);
    return { ok: false, runId: run.id, error };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Cron entrypoint: run a backup iff enabled and the schedule is due. */
export async function maybeRunScheduledBackup(): Promise<{ ran: boolean; skipped?: boolean; status?: string }> {
  const cfg = await getRow();
  if (!cfg.enabled) return { ran: false, skipped: true };
  const due = isBackupDue(
    { frequency: cfg.frequency as BackupFrequency, hourUtc: cfg.hourUtc, weekday: cfg.weekday, dayOfMonth: cfg.dayOfMonth },
    cfg.lastRunAt,
    new Date(),
  );
  if (!due) return { ran: false };
  const res = await runBackup("SCHEDULED", null);
  return { ran: true, status: res.ok ? "SUCCESS" : "FAILED" };
}
