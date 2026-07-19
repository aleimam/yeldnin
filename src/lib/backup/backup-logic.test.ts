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
  contentsToKind,
  isTierContents,
  clampEveryN,
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



// ── "every N" interval scheduling ───────────────────────────────────────────
const DAY = 86_400_000;
const dayIdx = (d: Date) => Math.floor(d.getTime() / DAY);
const weekIdx = (d: Date) => Math.floor(d.getTime() / (7 * DAY));

describe("lastScheduledFireTime — everyN", () => {
  it("everyN=1 is identical to the original behaviour", () => {
    const now = at("2026-07-19T09:40:00Z");
    const base = { hourUtc: 2, weekday: 1, dayOfMonth: 15 };
    for (const frequency of ["HOURLY", "DAILY", "WEEKLY", "MONTHLY"] as const) {
      const withN = lastScheduledFireTime({ frequency, everyN: 1, ...base }, now);
      const without = lastScheduledFireTime({ frequency, ...base }, now);
      expect(withN!.toISOString()).toBe(without!.toISOString());
    }
  });

  it("HOURLY every 2 lands on even UTC hours", () => {
    // a day is 24h and 24 is even, so epoch-hour parity == UTC-hour parity
    const s = { frequency: "HOURLY" as const, everyN: 2, hourUtc: 0, weekday: 0, dayOfMonth: 1 };
    expect(lastScheduledFireTime(s, at("2026-07-19T09:40:00Z"))!.toISOString()).toBe("2026-07-19T08:00:00.000Z");
    expect(lastScheduledFireTime(s, at("2026-07-19T08:00:00Z"))!.toISOString()).toBe("2026-07-19T08:00:00.000Z");
    expect(lastScheduledFireTime(s, at("2026-07-19T00:05:00Z"))!.toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });

  it("HOURLY every 6 lands on 00/06/12/18", () => {
    const s = { frequency: "HOURLY" as const, everyN: 6, hourUtc: 0, weekday: 0, dayOfMonth: 1 };
    expect(lastScheduledFireTime(s, at("2026-07-19T13:59:00Z"))!.toISOString()).toBe("2026-07-19T12:00:00.000Z");
    expect(lastScheduledFireTime(s, at("2026-07-19T05:00:00Z"))!.toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });

  it("DAILY every 2 fires at hourUtc on every other day, never in the future", () => {
    const s = { frequency: "DAILY" as const, everyN: 2, hourUtc: 2, weekday: 0, dayOfMonth: 1 };
    for (const iso of ["2026-07-19T09:40:00Z", "2026-07-20T01:00:00Z", "2026-07-21T23:59:00Z"]) {
      const now = at(iso);
      const fire = lastScheduledFireTime(s, now)!;
      expect(fire.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(fire.getUTCHours()).toBe(2);
      expect(dayIdx(fire) % 2).toBe(0);          // an every-other-day slot
      expect(now.getTime() - fire.getTime()).toBeLessThan(3 * DAY); // and the RECENT one
    }
  });

  it("WEEKLY every 2 fires on the chosen weekday, every other week", () => {
    const s = { frequency: "WEEKLY" as const, everyN: 2, hourUtc: 3, weekday: 0, dayOfMonth: 1 }; // Sunday
    for (const iso of ["2026-07-19T09:40:00Z", "2026-07-25T12:00:00Z", "2026-08-01T00:00:00Z"]) {
      const now = at(iso);
      const fire = lastScheduledFireTime(s, now)!;
      expect(fire.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(fire.getUTCDay()).toBe(0);
      expect(fire.getUTCHours()).toBe(3);
      expect(weekIdx(fire) % 2).toBe(0);
      expect(now.getTime() - fire.getTime()).toBeLessThan(3 * 7 * DAY);
    }
  });

  it("MONTHLY every 3 fires on the chosen day, every third month", () => {
    const s = { frequency: "MONTHLY" as const, everyN: 3, hourUtc: 4, weekday: 0, dayOfMonth: 15 };
    for (const iso of ["2026-07-19T09:40:00Z", "2026-01-02T00:00:00Z", "2026-12-31T23:00:00Z"]) {
      const now = at(iso);
      const fire = lastScheduledFireTime(s, now)!;
      expect(fire.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(fire.getUTCDate()).toBe(15);
      expect(fire.getUTCHours()).toBe(4);
      expect((fire.getUTCFullYear() * 12 + fire.getUTCMonth()) % 3).toBe(0);
    }
  });

  it("does not drift when a run is late — the slot is epoch-anchored", () => {
    const s = { frequency: "HOURLY" as const, everyN: 4, hourUtc: 0, weekday: 0, dayOfMonth: 1 };
    // whatever time we ask at, the answer is always a multiple-of-4 UTC hour
    for (const h of [0, 3, 7, 11, 15, 19, 23]) {
      const fire = lastScheduledFireTime(s, at(`2026-07-19T${String(h).padStart(2, "0")}:37:00Z`))!;
      expect(fire.getUTCHours() % 4).toBe(0);
      expect(fire.getUTCMinutes()).toBe(0);
    }
  });

  it("isBackupDue respects the interval", () => {
    const s = { frequency: "HOURLY" as const, everyN: 6, hourUtc: 0, weekday: 0, dayOfMonth: 1 };
    const now = at("2026-07-19T13:00:00Z"); // last slot was 12:00
    expect(isBackupDue(s, at("2026-07-19T12:30:00Z"), now)).toBe(false); // already ran in this slot
    expect(isBackupDue(s, at("2026-07-19T11:00:00Z"), now)).toBe(true);  // ran before the slot
    expect(isBackupDue(s, null, now)).toBe(true);
  });
});

describe("tier contents", () => {
  it("maps contents onto the archive kind that names the file", () => {
    expect(contentsToKind("DB")).toBe("db");
    expect(contentsToKind("FULL")).toBe("full");
    expect(contentsToKind("anything else")).toBe("full"); // safe default: more, not less
  });
  it("validates and clamps", () => {
    expect(isTierContents("DB")).toBe(true);
    expect(isTierContents("db")).toBe(false);
    expect(clampEveryN(0)).toBe(1);
    expect(clampEveryN(2)).toBe(2);
    expect(clampEveryN(99999)).toBe(365);
    expect(clampEveryN("x")).toBe(1);
  });
});
