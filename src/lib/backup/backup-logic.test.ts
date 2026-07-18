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
    expect(backupFileName(new Date("2026-07-17T02:03:04Z"))).toBe("yeldnin-backup-20260717-020304.tar.gz");
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
