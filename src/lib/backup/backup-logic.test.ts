import { describe, it, expect } from "vitest";
import {
  isBackupDue,
  lastScheduledFireTime,
  backupFileName,
  prunableArchives,
  ourArchives,
  contentsList,
  formatBytes,
  clampHour,
  clampDayOfMonth,
  clampRetention,
  isBackupProtocol,
  defaultPortFor,
  explainPathError,
  parseArchiveName,
  tieredPrunable,
  archiveKindFor,
  BACKUP_PROTOCOLS,
  type Schedule,
} from "./backup-logic";

const daily: Schedule = { frequency: "DAILY", hourUtc: 2, weekday: 1, dayOfMonth: 1 };

describe("isBackupDue — DAILY", () => {
  it("not due before the scheduled hour when already run in the last window", () => {
    const now = new Date("2026-07-17T01:30:00Z"); // 01:30, before today's 02:00
    // last fire was yesterday 02:00; ran yesterday 02:05 → not due
    expect(isBackupDue(daily, new Date("2026-07-16T02:05:00Z"), now)).toBe(false);
  });
  it("due at/after the scheduled hour when not yet run today", () => {
    const now = new Date("2026-07-17T02:10:00Z");
    expect(isBackupDue(daily, new Date("2026-07-16T02:05:00Z"), now)).toBe(true); // last run was yesterday
  });
  it("not due again once run in this window", () => {
    const now = new Date("2026-07-17T05:00:00Z");
    expect(isBackupDue(daily, new Date("2026-07-17T02:01:00Z"), now)).toBe(false);
  });
  it("first-ever run (no prior run) is due right away", () => {
    // Never run: the schedule's last fire (today or yesterday at 02:00) has passed
    // with no record, so a first backup is overdue regardless of the current hour.
    expect(isBackupDue(daily, null, new Date("2026-07-17T03:00:00Z"))).toBe(true);
    expect(isBackupDue(daily, null, new Date("2026-07-17T01:00:00Z"))).toBe(true);
  });
});

describe("isBackupDue — other frequencies", () => {
  it("OFF is never due", () => {
    expect(isBackupDue({ ...daily, frequency: "OFF" }, null, new Date("2026-07-17T02:10:00Z"))).toBe(false);
    expect(lastScheduledFireTime({ ...daily, frequency: "OFF" }, new Date())).toBeNull();
  });
  it("HOURLY due once per hour", () => {
    const s: Schedule = { ...daily, frequency: "HOURLY" };
    const now = new Date("2026-07-17T09:40:00Z");
    expect(isBackupDue(s, new Date("2026-07-17T08:50:00Z"), now)).toBe(true); // ran last hour
    expect(isBackupDue(s, new Date("2026-07-17T09:05:00Z"), now)).toBe(false); // already ran this hour
  });
  it("WEEKLY fires on its weekday", () => {
    // 2026-07-17 is a Friday (day 5). Schedule Monday(1) → last fire is Mon 2026-07-13.
    const s: Schedule = { frequency: "WEEKLY", hourUtc: 2, weekday: 1, dayOfMonth: 1 };
    const fire = lastScheduledFireTime(s, new Date("2026-07-17T12:00:00Z"))!;
    expect(fire.toISOString()).toBe("2026-07-13T02:00:00.000Z");
    expect(isBackupDue(s, new Date("2026-07-06T02:00:00Z"), new Date("2026-07-17T12:00:00Z"))).toBe(true);
    expect(isBackupDue(s, new Date("2026-07-13T02:00:00Z"), new Date("2026-07-17T12:00:00Z"))).toBe(false);
  });
  it("MONTHLY fires on its day-of-month", () => {
    const s: Schedule = { frequency: "MONTHLY", hourUtc: 2, weekday: 1, dayOfMonth: 15 };
    const fire = lastScheduledFireTime(s, new Date("2026-07-17T12:00:00Z"))!;
    expect(fire.toISOString()).toBe("2026-07-15T02:00:00.000Z");
    // before the 15th → previous month's 15th
    const early = lastScheduledFireTime(s, new Date("2026-07-10T12:00:00Z"))!;
    expect(early.toISOString()).toBe("2026-06-15T02:00:00.000Z");
  });
});

describe("archive naming + pruning", () => {
  it("names UTC-stamped tar.gz", () => {
    // defaults to a FULL archive; the kind is part of the name since tiering
    expect(backupFileName(new Date("2026-07-17T02:03:04Z"))).toBe("yeldnin-backup-full-20260717-020304.tar.gz");
  });
  it("recognises + orders our archives newest-first", () => {
    const names = ["yeldnin-backup-20260101-000000.tar.gz", "other.txt", "yeldnin-backup-20260201-000000.tar.gz"];
    expect(ourArchives(names)).toEqual(["yeldnin-backup-20260201-000000.tar.gz", "yeldnin-backup-20260101-000000.tar.gz"]);
  });
  it("prunes all but the newest N, ignoring foreign files", () => {
    const names = ["a.txt", "yeldnin-backup-20260101-000000.tar.gz", "yeldnin-backup-20260301-000000.tar.gz", "yeldnin-backup-20260201-000000.tar.gz"];
    expect(prunableArchives(names, 2)).toEqual(["yeldnin-backup-20260101-000000.tar.gz"]);
    expect(prunableArchives(names, 0)).toEqual([]); // keep all
    expect(prunableArchives(names, 5)).toEqual([]); // fewer than keep
  });
});

describe("helpers", () => {
  it("contentsList reflects toggles", () => {
    expect(contentsList({ includeDb: true, includeUploads: false })).toEqual(["db"]);
    expect(contentsList({ includeDb: true, includeUploads: true })).toEqual(["db", "uploads"]);
    expect(contentsList({ includeDb: false, includeUploads: false })).toEqual([]);
  });
  it("clamps", () => {
    expect(clampHour(25)).toBe(23);
    expect(clampHour(-1)).toBe(0);
    expect(clampDayOfMonth(31)).toBe(28);
    expect(clampRetention(-5)).toBe(0);
    expect(clampRetention("x")).toBe(30);
  });
  it("formatBytes", () => {
    expect(formatBytes(0)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("backup protocols", () => {
  it("offers both FTPS and SFTP", () => {
    expect([...BACKUP_PROTOCOLS]).toEqual(["FTPS", "SFTP"]);
  });

  it("recognises only known protocols", () => {
    expect(isBackupProtocol("FTPS")).toBe(true);
    expect(isBackupProtocol("SFTP")).toBe(true);
    expect(isBackupProtocol("sftp")).toBe(false); // case-sensitive: stored value is upper
    expect(isBackupProtocol("SCP")).toBe(false);
    expect(isBackupProtocol(null)).toBe(false);
  });

  it("defaults the port per protocol", () => {
    expect(defaultPortFor("FTPS")).toBe(21);
    expect(defaultPortFor("SFTP")).toBe(22);
  });
});

describe("explainPathError", () => {
  it("appends the writable home to a permission error", () => {
    const out = explainPathError("mkdir: _doMkdir: Bad path: /backup permission denied", "/home");
    expect(out).toContain("can only write inside");
    expect(out).toContain('"/home"');
    expect(out).toContain("/home/backup"); // a concrete, valid example to copy
  });

  it("leaves unrelated errors alone", () => {
    const msg = "Timeout (control socket)";
    expect(explainPathError(msg, "/home")).toBe(msg);
  });

  it("is a no-op when the home is unknown", () => {
    const msg = "permission denied";
    expect(explainPathError(msg, null)).toBe(msg);
  });

  it("does not emit a doubled slash when the home is root", () => {
    expect(explainPathError("permission denied", "/")).toContain('"/backup"');
  });
});

// ── Tiered retention ────────────────────────────────────────────────────────
const at = (iso: string) => new Date(iso);
const nm = (kind: "db" | "full", iso: string) => backupFileName(at(iso), kind);

describe("archive naming + parsing", () => {
  it("encodes the kind in the filename", () => {
    expect(nm("db", "2026-07-19T21:00:00Z")).toBe("yeldnin-backup-db-20260719-210000.tar.gz");
    expect(nm("full", "2026-07-19T02:00:00Z")).toBe("yeldnin-backup-full-20260719-020000.tar.gz");
  });

  it("round-trips kind + timestamp", () => {
    const p = parseArchiveName(nm("db", "2026-07-19T21:34:05Z"))!;
    expect(p.kind).toBe("db");
    expect(p.at.toISOString()).toBe("2026-07-19T21:34:05.000Z");
  });

  it("treats pre-kind legacy names as full", () => {
    const p = parseArchiveName("yeldnin-backup-20260719-215159.tar.gz")!;
    expect(p.kind).toBe("full");
    expect(p.at.toISOString()).toBe("2026-07-19T21:51:59.000Z");
  });

  it("refuses anything that is not ours", () => {
    expect(parseArchiveName("notes.txt")).toBeNull();
    expect(parseArchiveName("yeldnin-backup-db-2026-07-19.tar.gz")).toBeNull(); // wrong stamp
    expect(parseArchiveName("yeldnin-backup-weekly-20260719-000000.tar.gz")).toBeNull(); // unknown kind
    expect(parseArchiveName("other-backup-full-20260719-000000.tar.gz")).toBeNull();
  });

  it("orders by timestamp, not lexically (kinds interleave)", () => {
    const older = nm("full", "2026-07-19T02:00:00Z");
    const newer = nm("db", "2026-07-19T21:00:00Z");
    // lexically "db" < "full", so a naive sort would get this backwards
    expect(ourArchives([older, newer])[0]).toBe(newer);
  });
});

describe("tieredPrunable", () => {
  const POLICY = { keepHourly: 24, keepDaily: 7, keepWeekly: 8 };
  // 30 hourly db archives + 40 daily full archives, newest 2026-07-19.
  const dbNames = Array.from({ length: 30 }, (_, i) =>
    nm("db", new Date(Date.UTC(2026, 6, 19, 12, 0, 0) - i * 3600_000).toISOString()));
  const fullNames = Array.from({ length: 40 }, (_, i) =>
    nm("full", new Date(Date.UTC(2026, 6, 19, 2, 0, 0) - i * 86400_000).toISOString()));
  const all = [...dbNames, ...fullNames];

  it("keeps exactly the newest keepHourly db archives", () => {
    const del = tieredPrunable(all, POLICY);
    const survivingDb = dbNames.filter((n) => !del.includes(n));
    expect(survivingDb).toHaveLength(24);
    expect(survivingDb).toEqual(dbNames.slice(0, 24)); // the newest 24
  });

  it("keeps the newest keepDaily full archives outright", () => {
    const del = tieredPrunable(all, POLICY);
    for (const n of fullNames.slice(0, 7)) expect(del).not.toContain(n);
  });

  it("thins older full archives to one per week", () => {
    const del = tieredPrunable(all, POLICY);
    const survivingOlder = fullNames.slice(7).filter((n) => !del.includes(n));
    // 33 remaining days span ~5 week buckets, all under the 8-week allowance
    expect(survivingOlder.length).toBeGreaterThan(3);
    expect(survivingOlder.length).toBeLessThanOrEqual(8);
    const weeks = survivingOlder.map((n) =>
      Math.floor(parseArchiveName(n)!.at.getTime() / (7 * 86400_000)));
    expect(new Set(weeks).size).toBe(weeks.length); // one per week, no duplicates
  });

  it("never touches files it does not recognise", () => {
    const del = tieredPrunable([...all, "notes.txt", "someone-elses.tar.gz"], POLICY);
    expect(del).not.toContain("notes.txt");
    expect(del).not.toContain("someone-elses.tar.gz");
  });

  it("never deletes the most recent archive, even on a zeroed policy", () => {
    const zero = { keepHourly: 0, keepDaily: 0, keepWeekly: 0 };
    const del = tieredPrunable(all, zero);
    const newest = ourArchives(all)[0];
    expect(del).not.toContain(newest);
    expect(del).toHaveLength(all.length - 1); // everything else goes
  });

  it("is a no-op on an empty or foreign-only listing", () => {
    expect(tieredPrunable([], POLICY)).toEqual([]);
    expect(tieredPrunable(["a.txt", "b.zip"], POLICY)).toEqual([]);
  });
});

describe("archiveKindFor", () => {
  const tiered = { tiered: true, hourUtc: 2 };
  const lastFull = at("2026-07-19T02:00:00Z");

  it("is always full when tiering is off", () => {
    expect(archiveKindFor({ tiered: false, hourUtc: 2 }, lastFull, at("2026-07-19T15:00:00Z"))).toBe("full");
  });

  it("takes a full archive at the configured hour", () => {
    expect(archiveKindFor(tiered, lastFull, at("2026-07-20T02:30:00Z"))).toBe("full");
  });

  it("takes db-only at every other hour", () => {
    expect(archiveKindFor(tiered, lastFull, at("2026-07-19T15:00:00Z"))).toBe("db");
  });

  it("forces a full when none has ever been taken", () => {
    expect(archiveKindFor(tiered, null, at("2026-07-19T15:00:00Z"))).toBe("full");
  });

  it("recovers a missed full slot rather than skipping a day", () => {
    // app was down at 02:00; by 04:00 the next day the last full is >25h old
    expect(archiveKindFor(tiered, at("2026-07-18T02:00:00Z"), at("2026-07-19T04:00:00Z"))).toBe("full");
  });
});
