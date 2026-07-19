# Off-site Backup module — portable spec

> Reference implementation: **YeldnIN** (`C:\Claude\YeldnIN`). This document
> exists so the **VEEEY** and **NOC** apps can build the same module, and because
> all three back up to the **same Hetzner Storage Box** — which makes a few of
> the rules below mandatory rather than advisory.
>
> Written 2026-07-20 after building it end-to-end on YeldnIN production. Every
> gotcha in §8–§10 cost real debugging time or a real outage; read those before
> writing code, not after.

---

## 1. What the module does

Scheduled, off-site archives of the app's **database + uploaded files**, pushed
to a remote server over **SFTP**, with independent retention levels.

Three configurable **tiers**, each with its own cadence, contents, folder and
retention. YeldnIN's live shape:

| Tier | Frequency | Contents | Folder | Keep |
|---|---|---|---|---|
| Frequent | Hourly | database only (~5 MB) | `…/hourly` | 24 |
| Daily | Daily 02:00 UTC | database + uploads (~50 MB) | `…/daily` | 7 |
| Weekly | Weekly Sunday 02:00 UTC | database + uploads | `…/weekly` | 8 |

**Why tiers, and why the frequent one is database-only:** uploads are ~10× the
database once compressed and barely change, so re-shipping them hourly is waste.
Hourly database snapshots cover the common disaster (bad data, a wrong bulk edit,
corruption) where the files on disk are still fine. The daily/weekly full
archives cover total server loss.

> **Trade-off to state to the owner:** after a *total* loss you restore the newest
> **full** archive (up to 24h old) then apply the newest **hourly** database on
> top — data is current to the last hour, but files uploaded in the final hours
> are missing while the database still references them. Shorten the full cadence
> if that window is too wide.

---

## 2. ⚠ Shared storage — MANDATORY rules

All three apps write to one Hetzner Storage Box. Nothing on the box enforces
separation, so **retention in one app can delete another app's archives** if
these rules are broken.

### 2.1 Prefer a Hetzner **sub-account** per app (strongly recommended)

The Storage Box console has a **Subaccounts** tab. Create one per app, each
confined to its own home directory, with its own password. Then an app
*cannot* reach another app's files even with a bug or a bad config. This is the
only real isolation available — do this if the owner agrees.

### 2.2 If sharing the one account, then without exception:

1. **Own top-level folder.** `/home/<app>/…` — never write outside it.
   YeldnIN owns `/home/yeldnin`. Pick `/home/veeey`, `/home/noc`.
2. **Own filename prefix.** YeldnIN writes `yeldnin-backup-…`. Yours MUST be
   `veeey-backup-…` / `noc-backup-…`. The prefix is what the pruner matches;
   it is the last line of defence if two apps ever share a folder.
3. **Never point two apps (or two tiers) at the same folder.** Retention is
   "keep newest N *in this folder*" — two writers means each prunes the other.
4. **The pruner must ignore anything it cannot parse.** Foreign files are never
   deletion candidates. (Invariant, §5.3.)

### 2.3 Connection details

Host `u635384.your-storagebox.de`, username `u635384` (or your sub-account),
**port 23**, protocol **SFTP**. The **password comes from the owner** — never
commit it, never log it, never print it in chat. Store it encrypted at rest
(§7).

---

## 3. Data model

Three tables. Names are YeldnIN's; adapt to your ORM.

```prisma
model BackupConfig {           // single row — the connection
  singleton       String  @unique @default("BACKUP")
  enabled         Boolean @default(false)   // master switch
  protocol        String  @default("SFTP")  // SFTP | FTPS
  host            String?
  port            Int     @default(22)
  username        String?
  passwordEnc     String?                   // AES-256-GCM, never sent to client
  remotePath      String  @default("/")     // base folder; Test connection uses it
  secure          Boolean @default(true)    // FTPS explicit TLS only
  notifyOnFailure Boolean @default(true)
  lastTestAt      DateTime?
  lastTestOk      Boolean?
  lastTestMessage String?
  lastRunAt       DateTime?
}

model BackupTier {             // one row per level
  key        String   @unique  // HOURLY | DAILY | WEEKLY
  enabled    Boolean  @default(true)
  frequency  String   @default("DAILY") // OFF|HOURLY|DAILY|WEEKLY|MONTHLY
  everyN     Int      @default(1)       // every N hours/days/weeks/months
  hourUtc    Int      @default(2)
  weekday    Int      @default(0)       // 0=Sun..6=Sat
  dayOfMonth Int      @default(1)       // 1..28 (so every month has it)
  contents   String   @default("FULL")  // DB | FULL
  remotePath String   @default("/")     // this tier's own folder
  keepLast   Int      @default(7)       // 0 = keep all
  sortOrder  Int      @default(0)
  lastRunAt  DateTime?                  // per-tier — keeps cadences independent
}

model BackupRun {              // history/audit
  tierKey    String?
  startedAt  DateTime @default(now())
  finishedAt DateTime?
  status     String   // RUNNING | SUCCESS | FAILED
  trigger    String   // MANUAL | SCHEDULED
  contents   String   // "db" | "db,uploads" — what it ACTUALLY held
  fileName   String?
  sizeBytes  Int?
  error      String?
}
```

**Seed the tiers on first access** (and, on an upgrade, seed them *from* whatever
schedule existed before — an upgrade must not silently reset the operator's
settings).

---

## 4. Archive naming

```
<app>-backup-<kind>-YYYYMMDD-HHmmss.tar.gz     kind = db | full
e.g. yeldnin-backup-db-20260719-230903.tar.gz
```

UTC timestamps. Contents: the database dump at the root, `uploads/` when the
tier is `FULL`, plus a `manifest.json` recording `{app, kind, createdAt,
contents}`.

**The manifest must describe what the archive ACTUALLY holds** — a db-only
archive must never claim to contain uploads.

⚠ **The kind segment breaks "lexical order == chronological order."** If you sort
listings as strings you will get the wrong newest file (`db-` sorts before
`full-`). Parse the timestamp and sort by it.

---

## 5. Pure logic (unit-test all of it)

Keep this in an import-clean module with no DB/IO — YeldnIN uses
`src/lib/backup/backup-logic.ts` + `backup-logic.test.ts` (36 tests).

### 5.1 Scheduling with `everyN`

`lastScheduledFireTime(schedule, now)` returns the most recent moment the
schedule should have fired, or null when `OFF`. Then:

```ts
isBackupDue(s, lastRunAt, now) =
  fire !== null && (lastRunAt == null || lastRunAt < fire)
```

**`everyN` must be anchored to FIXED epoch slots, never to the previous run.**

```ts
// HOURLY: slot = floor(now / HOUR); fire = (slot - slot % n) * HOUR
// DAILY:  candidate = today@hourUtc (or yesterday if future),
//         then step back a day while floor(fire/DAY) % n !== 0
// WEEKLY: same, stepping back 7 days, using floor(fire/WEEK) % n
// MONTHLY: step back months while (year*12+month) % n !== 0
```

Anchoring matters: "every 2 hours" is then always the even UTC hours, so a late
or missed run can never shift the whole series. Anchoring to `lastRunAt` drifts
a little further every time. Use a negative-safe modulo and **bound the
walk-back loops**. `n = 1` must reproduce the non-`everyN` behaviour exactly —
assert that for all four frequencies.

Note: `everyN` gives clean UTC-hour semantics for divisors of 24 (1,2,3,4,6,8,12);
other values still work but the hours shift day to day.

### 5.2 Parsing

`parseArchiveName(name)` → `{kind, at}` or **null**. Return null for anything
that isn't yours: wrong prefix, wrong stamp shape, unknown kind. Accept your own
pre-tier legacy names (no kind segment) as `full` if you have any.

### 5.3 Retention — the dangerous part

Per-tier folders make this simple: **keep the newest N in this folder**, delete
the rest. Because folders are homogeneous there is no cross-kind reasoning.

Two invariants, both unit-tested, because this deletes real backups:

1. **A file that cannot be parsed is NEVER a deletion candidate.**
2. **The single most recent archive is NEVER deleted**, whatever the policy says
   (guards against a mis-set `keepLast: 0`).

Also: **log every prune** (`[backup] <tier>: pruning N in <dir>: <names>`) so it
can be audited from the process logs afterwards.

---

## 6. Transport

Define a small interface and implement per protocol:

```ts
type Transport = {
  homeDir: string | null;              // login dir — used for error messages
  ensureDir(dir): Promise<void>;       // create when missing
  list(dir): Promise<string[]>;        // file names
  upload(localPath, dir, fileName): Promise<void>;
  remove(dir, fileName): Promise<void>;
};
```

**Use SFTP** (`ssh2-sftp-client`): single connection, absolute paths, no data
channel. `connect / exists / mkdir(p, true) / list / fastPut / delete / end`.

**FTPS (`basic-ftp`) is supported but avoid it** — see §8.2 for why it cannot
work against this storage box from these servers. If you do implement it, note
it is cwd-based (re-enter the directory for each operation) whereas SFTP is
absolute-path based.

**Error messages:** capture the login directory (SFTP `cwd()`, FTPS `pwd()`) and,
when an operation fails with a path/permission error, append it plus a valid
example. A bare `Bad path: /backup permission denied` tells the operator nothing;
`… — this account can only write inside "/home", so the remote folder must start
with it (e.g. "/home/backup")` tells them everything.

---

## 7. Building the archive

1. **Consistent database snapshot** — engine-specific, this is the part you must
   change:
   - **SQLite (YeldnIN):** `VACUUM INTO '<dest>'`, with
     `PRAGMA busy_timeout = 10000` so it waits out the live app's WAL writes.
     Safe while the app is running.
   - **Postgres (VEEEY):** `pg_dump -Fc` to a file. Use a read-only role if you
     have one; do not hold a long transaction on a busy box.
   - **MySQL:** `mysqldump --single-transaction`.
2. Copy `uploads/` **only when the tier's contents is `FULL`**.
3. Write `manifest.json` (actual contents, §4).
4. `tar` + gzip the staging directory.
5. Upload, then prune (§5.3).
6. Record the `BackupRun`; update the tier's `lastRunAt`; notify admins on
   failure if configured.

Do all of this in a temp directory and remove it in a `finally`.

**Secrets:** encrypt the password at rest (YeldnIN: AES-256-GCM with a key
derived from `SESSION_SECRET` via HKDF — rotating that secret invalidates it and
the owner simply re-enters it). Never send it to the client; the form posts an
empty password to mean "keep the stored one". Gate the whole settings page and
every action on admin.

---

## 8. Hetzner Storage Box specifics (hard-won)

### 8.1 Ports and paths

- **SSH/SFTP is port 23**, FTP/FTPS is 21. Port 22 is *not* the SFTP port here.
- The session lands in **`/home`** and the real `/` is **not writable**. Every
  remote path must start with `/home/`. `/backup/...` fails with
  `Bad path … permission denied`.
- **Port 22 also answers, but it is chrooted to the account home** — so the same
  path means a *different* directory there. Writing `/home/x` over port 22
  silently creates `/home/home/x`. **Stay on 23.**

### 8.2 Why FTPS cannot work here

Three failures stack up:

1. The host resolves **IPv6 first**, and its FTP server cannot build a passive
   listener for an IPv6 peer → `421 Could not listen for passive connection:
   invalid passive IP "[2a01"`.
2. Forcing IPv4 then fails TLS unless you also pass `secureOptions.servername`
   (the wildcard cert does not match an IP literal).
3. Even then the passive data port (ephemeral, observed 52314–58480) is
   **refused by the CSF firewall**, whose `TCP_OUT` allows only a fixed low-port
   list. The kernel's `nf_conntrack_ftp` helper cannot rescue this because FTPS
   **encrypts the control channel**, so the firewall can never read the PASV
   reply.

(3) is unfixable in code. SFTP moves data over the same connection and needs
exactly **one** outbound port instead of ~28,000.

### 8.3 Server prerequisite — CSF

These boxes run CWP + CSF, which restricts **outbound** ports. Port 23 must be
allowed or SFTP cannot connect:

```
/etc/csf/csf.conf  →  TCP_OUT / TCP6_OUT  must include 23
csf -r             # reload
```

Back up `csf.conf` first. Adding to `TCP_OUT` is outbound-only, so it cannot
lock you out. On YeldnIN's box this is **already done** — verify before assuming
it is missing.

---

## 9. Triggering

The app decides when a run is *due*; something external just ticks.

- **YeldnIN:** a root crontab every 10 min hits
  `GET/POST /api/cron/backup` with an `x-cron-key` header matched against
  `CRON_SECRET` (constant-time compare; header only, never a query string). An
  admin session is also accepted so it can be triggered by hand.
- **VEEEY:** you already run **pg-boss** — schedule a queue instead of a cron
  endpoint. Same logic: on each tick, loop the tiers and run the due ones.

The tick handler must loop **every enabled tier** and run each that is due —
independently, so one tier failing or being off never blocks the others.

"Backup now" should run **every enabled tier once**, so a single click proves
each folder and each contents choice end to end.

---

## 10. Build & deploy gotchas

### 10.1 `ssh2` breaks a Next.js build unless externalised

`ssh2` ships an optional native `sshcrypto.node`; webpack has no loader for a
binary and the build fails outright.

```js
// next.config.mjs
serverExternalPackages: ["@prisma/client", "prisma", "ssh2", "ssh2-sftp-client"],
```

⚠ **This does not reproduce on every machine.** The addon only exists once
ssh2's install script has run — production `npm ci` builds it, while a dev box
with npm script-blocking never has the file, so the build passes locally and
fails in production. **A green local build does not clear a native-dependency
change.**

### 10.2 Never pipe the build in a deploy script

```bash
npm run build | tail -4      # ✗ $? comes from tail — `set -e` never fires
```

This masked a failure, the script carried on, and the process was restarted onto
a broken build → site down. Use:

```bash
if npm run build > /tmp/build.log 2>&1; then
  pm2 restart <app>
else
  echo "BUILD FAILED"; tail -20 /tmp/build.log; exit 1   # do NOT restart
fi
```

### 10.3 Stale clients must not silently rewrite settings

A browser holding an older version of the form posts a payload missing the newer
fields. If you default those to a constant, a save from that tab **silently
downgrades a working config** (this happened: SFTP quietly reverted to FTPS, and
a custom port was reset). **Fall back to the STORED value, not to a default,**
for every field a stale client might omit.

Related: if a control re-defaults another field (e.g. changing protocol resets
the port), only do so when that field still holds the *outgoing* default — never
clobber a deliberately-set value. Hetzner's port 23 is exactly such a value.

---

## 11. Verification checklist

Do not report success on a status field alone — **list the remote folder and
confirm the file is really there.**

- [ ] Test connection succeeds (and a bad path produces a message naming the
      writable home).
- [ ] "Backup now" produces one archive **per enabled tier**, each in **its own
      folder**, with the right size profile (db ≈ small, full ≈ large).
- [ ] `manifest.json` inside a db-only archive does **not** claim uploads.
- [ ] Retention: with `keepLast` exceeded, older archives disappear and the
      prune is logged; foreign files in the folder are untouched.
- [ ] A scheduled (not manually triggered) run fires on its own.
- [ ] **Restore drill** — actually unpack an archive and load the database
      somewhere. An untested backup is a hypothesis.

---

## 12. Reference implementation map (YeldnIN)

| File | What |
|---|---|
| `src/lib/backup/backup-logic.ts` | pure: scheduling (`everyN`), naming/parsing, retention, clamps |
| `src/lib/backup/backup-logic.test.ts` | 36 tests incl. the retention safety invariants |
| `src/lib/backup/backup-service.ts` | transports, archive build, upload+prune, tier CRUD, cron entry |
| `src/app/settings/backup/{page,BackupForm,actions}.tsx` | admin UI + server actions |
| `src/app/api/cron/backup/route.ts` | cron entrypoint |
| `src/types/ssh2-sftp-client.d.ts` | local types (the package ships none) |
| `src/lib/crypto/secret-box.ts` | AES-256-GCM encrypt/decrypt for the password |

History worth reading if something looks odd: `524cff6` (SFTP transport),
`1ad8ce4` (webpack externals / the outage), `1b6ee46` + `560b46d` (stale-client
defences), `2f6a692` (path-error messages), `426d59b` (independent tiers).

---

## 13. Open items on YeldnIN (do not inherit)

- Pre-tier archives sit loose in `/home/yeldnin` and one stray in
  `/home/home/yeldnin` — outside every tier, so retention never reaps them.
  Awaiting owner approval to delete.
- No restore drill has been performed yet. **Do one before trusting any of this.**
