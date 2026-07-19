# HANDOFF — YeldnIN operational knowledge

> Last updated 2026-07-19 for whoever (human or Claude) takes this project over.
> `CLAUDE.md` covers the stack + conventions; `APP_BLUEPRINT.md` the product
> spec; `DEPLOY.md` the deploy steps. This file carries everything that
> otherwise lived only in the previous assistant's session memory: the
> operational runbook with its hard-earned gotchas, the security/permission
> decisions and why they're shaped that way, and the exact current state.
> **Note:** this repo is worked by several concurrent Claude sessions/accounts;
> `main`, and even prod, can move past what any one session last did — always
> re-check actual `git`/prod state before committing or deploying (see the
> runbook). This file is the shared source of truth across accounts.

## Current state (2026-07-19)

- **App version 1.18.0**, ~50k lines, ~120 routes, 397 unit tests, typecheck clean.
- **Production**: live at https://in.yeldn.com, deployed at commit `816cdd2`.
  `main` == `origin/main` == prod. No pending migrations, no undeployed work.
- All modules from the blueprint are built and deployed: supply chain
  (products/requests/purchasing/patches/transfers/shipments/hubs/trips/
  travelers/couriers/carriers/items), Pricing, Issues & Compensations,
  CS Quality (incl. the full veto workflow), HR (complete, phases 1–5),
  Chat + Inquiries, Documents (Tiptap editor + PDF letterhead export),
  Expenses, History, notifications (in-app inbox + web push), Audit/Error logs,
  Settings (VEEEY integration + **Backup** module).
- Spec documents live **untracked** in the repo root on the dev machine
  (`YeldnIN Description.docx`, `Human Resources Module.docx`, `YeldnIN-CS/
  Chat/Documents/Evaluation/Notes.docx`, `PDD.docx`, `Status.xlsx`, and the
  `Products*.csv/xlsx` spreadsheets). They are inputs, not code — don't commit
  them, don't lose them (there is no documented off-machine backup). The
  `Pricing.xlsx` older docs mention no longer exists — its math is implemented
  in the Pricing module.

### Changed since the last handoff (`f36d1a0` → `816cdd2`)

- **VEEEY integration is now LIVE** (was "phase 2 pending" in the old handoff).
  Enabled on prod (`baseUrl https://veeey.com`). What syncs — and ONLY this:
  - **Product catalog: Veeey → YeldnIN, inbound only** (Veeey is the master).
    `POST /api/integration/v1/catalog` upserts products keyed on `wpId`
    (WordPress id → `Product.veeeyWpId`). 2,548 / 2,560 products linked. YeldnIN
    never pushes catalog back.
  - **Requests: both directions**, uid-keyed. Outbound: every request
    create/update queues a `request.upsert` (`emitRequestSync` →
    `OutboxEvent`, drained on the advance cron) → signed webhook. Inbound:
    `POST /api/integration/v1/requests` upserts by shared `uid`, matching lines
    to local products by SKU. **Inbound reflects the record only — it does NOT
    drive the pipeline** (no item-spawning on approval); customer travels as
    name/phone only.
  - Plumbing: HMAC-signed, nonce replay-guard + idempotency ledger; gated by the
    per-provider `enabled` flag. Code in `src/lib/integration/*` +
    `src/app/api/integration/v1/*`.
  - ⚠ **Caveat:** the inbound key was never generated on prod
    (`ApiIntegration.inboundKeyAt` is null) — so Veeey→YeldnIN authenticated
    inbound may not be fully armed. Regenerate + exchange it in Settings →
    Integrations if inbound is relied on.
- **CS Quality — full veto workflow.** `/cs-quality/vetoes` is now a section open
  to all CS users: managers get the pending keep/delete queue **and** a resolved
  history (with the rep's veto reason + the resolver's decision comment as
  columns); everyone sees "Related to me" (vetoes they cast + vetoes on
  evaluations they authored). Resolving now **requires a decision comment**
  (`resolveVeto` throws if blank; buttons disabled until entered). Casting a veto
  notifies CS managers **and** the evaluator whose evaluation was disputed
  (personalized, de-duped). All in `src/lib/cs/cs-veto-service.ts` +
  `src/app/cs-quality/vetoes/`.
- **NEW: Backup module** (`816cdd2`) — see its own section below.

## Production & deployment runbook

Target box: `204.168.129.186` (CWP + nginx; also hosts the separate `veeey`
storefront). App dir **`/home/yeldn/app`**, PM2 process **`yeldnin`**, internal
port **3200**, nginx vhost `/etc/nginx/conf.d/yeldnin-app.conf`, SSL via
Certbot. Server Node is **22.x** → `node:sqlite` needs
`NODE_OPTIONS=--experimental-sqlite` for CLI commands (`build`, `db:seed`);
the *running* process gets it from `ecosystem.config.js`.

Deploys go over SSH. This dev machine already has key-based root access set up:
`~/.ssh/config` defines a **`veeey`** host alias → `204.168.129.186`, `User root`,
`IdentityFile ~/.ssh/id_ed25519` — so `ssh veeey '…'` works from here and a
same-machine session can **self-deploy** (use `-o BatchMode=yes`). A new operator
on a *different* machine needs their own SSH key authorized on the box (or a
guided deploy where the owner pastes commands). Never paste the FTPS or session
secrets into chat; enter secrets only in the app UI or the server `.env.local`.

**Golden deploy rules (each learned from a real incident):**

1. **Push first.** The deploy is `git pull`-based. Verify
   `git log origin/main..main` is EMPTY before deploying — a forgotten push
   once produced a "successful" deploy of old code.
2. **Always `cd /home/yeldn/app` first.** A paste into `/root` once ran every
   step against nothing while pm2 still restarted — app came back up on old
   code looking deployed.
3. **Code-only change** (no schema, no deps, no seed data):
   `git pull --ff-only` → `NODE_OPTIONS=--experimental-sqlite npm run build`
   → `pm2 reload yeldnin`. That's it.
4. **Schema-changing deploy** (order matters, twice bitten):
   `git pull` → `npm ci` *(if deps changed)* → `npx prisma generate`
   **(ALWAYS on schema change — `migrate deploy` does NOT regenerate the
   client; skipping this broke the build/runtime twice)* → `pm2 stop yeldnin`
   **(WAL lock: `migrate deploy` fails "database is locked" while the app
   runs)** → `npx prisma migrate deploy` → `npm run build` **(build AFTER
   migrate: a prerendered route reading a new column against an un-migrated
   DB once produced a broken `.next` and site-down)** → `npm run db:seed`
   *(idempotent; only when seed data changed)* → `pm2 restart yeldnin`.
5. **Verify after every deploy:** `pm2 list` online + fresh PID,
   `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3200/login` = 200,
   same for `https://in.yeldn.com/login`, then
   `pm2 logs yeldnin --nostream --lines 20`. Lines saying
   `Failed to find Server Action` right after a deploy are benign
   (stale browser tabs on the old build).
6. **nginx gotcha:** if certbot ever rewrites the vhost, it emits
   `listen 443 ssl` (wildcard) — this box needs
   `listen 204.168.129.186:443 ssl` or requests fall through to CWP's
   self-signed default. See DEPLOY.md.
7. Ops extras: two root crontab entries, both **every 10 minutes**, `curl` with
   an `x-cron-key` header (`CRON_SECRET` in server `.env.local`):
   `/api/cron/advance` (item auto-advance + Veeey outbox drain + SLA alerts +
   error-log prune) and `/api/cron/backup` (runs a backup only when the admin's
   schedule is due — inert while the Backup module is disabled). Web-push VAPID
   keys are also in server `.env.local` (gitignored, survives pulls). Uploads
   live in `./uploads`; the DB is `prisma/dev.db` (gitignored). Both are now also
   covered by the in-app **Backup** module once an admin configures it.
8. **Lockfile-drift gotcha (recurs on every `npm ci` deploy).** Prod's older npm
   (Node 22) strips `"libc": ["glibc"]` metadata from optional platform packages
   in `package-lock.json`, leaving an uncommitted local change that makes
   `git pull` abort ("local changes would be overwritten"). It's cosmetic — the
   committed lockfile is authoritative. Lead any deps-changing deploy with
   `git checkout -- package-lock.json` before `git pull`, then `npm ci`.

**What the owner must hand over separately (not in this repo, by design):**
SSH access to the box (the previous operator used a personal key + a local
`veeey` host alias), GitHub push access to `aleimam/yeldnin`, the production
admin login, and — if the server is ever rebuilt — the server-side
`.env.local` values (`SESSION_SECRET`, `CRON_SECRET`, VAPID keys). Also decide
a backup home for the untracked spec documents and the prod DB/uploads.

## Backup module (Settings → System → Backup, admin-only)

New in `816cdd2`. Lets an admin push off-site backups to their own **FTPS** server.

- **Config** (`BackupConfig`, single row, lazily created): host/port/username/
  password/remote-folder/TLS, contents toggles (Database, Uploaded files),
  schedule (Off/Hourly/Daily/Weekly/Monthly + UTC time), retention (keep newest
  N), notify-on-failure. The **password is encrypted at rest** with the same
  AES-GCM vault as the VEEEY secret (`src/lib/crypto/secret-box.ts`, keyed off
  `SESSION_SECRET`) and never returned to the browser.
- **A run** (`BackupRun`, history log): DB is snapshotted consistently via
  `VACUUM INTO` (safe under WAL), bundled with `uploads/` into a `.tar.gz`,
  uploaded over FTPS (`basic-ftp`), then old archives are pruned to the newest N.
  Manual **Backup now** + **Test connection** buttons; a run history/status
  table; failure alerts to admins via `sendLocalizedCustomNotification`.
- **Scheduler:** `/api/cron/backup` (root crontab, every 10 min) calls
  `maybeRunScheduledBackup()`, which runs only when `isBackupDue()` says the
  schedule is due. All pure schedule/naming/pruning logic is unit-tested in
  `src/lib/backup/backup-logic.ts`.
- Code: `src/lib/backup/*`, `src/app/settings/backup/*`,
  `src/app/api/cron/backup/route.ts`. Deps added: `basic-ftp` + `tar` (both
  pure-JS, ARM-safe).
- ⚠ **It ships DISABLED.** To activate, an admin opens Settings → Backup, enters
  the FTPS details, clicks **Test connection**, picks contents + a schedule, and
  enables it. (Claude will not type the FTPS password into the form — that is the
  admin's to enter.) Nothing runs until then.

## Dev-machine gotchas (Windows on ARM)

- The Prisma engine-free setup in `CLAUDE.md` is load-bearing — never switch
  to the native engine or better-sqlite3 on this machine.
- **Dev 500s after long HMR sessions**: the `.next` cache corrupts. Fix =
  stop dev server, `rm -rf .next`, restart. It is not a code bug (prod builds
  stay clean).
- **`tsconfig.tsbuildinfo` can mask type errors in `*.test.ts`** (Next's
  build excludes tests; incremental `tsc` can cache past them). When in
  doubt: `rm -f tsconfig.tsbuildinfo && npm run typecheck`.
- **`public/sw.js` must never register a `fetch` handler** — even an empty
  one cold-boots the worker per request and made the whole prod app slow
  (diagnose that class of issue via incognito-vs-normal).
- **`src/instrumentation.ts`**: any DB-touching import must sit *inside* the
  `if (process.env.NEXT_RUNTIME === "nodejs")` block (block form, not
  early-return) or webpack's edge compile pulls `node:path` into the edge
  bundle and every dev request 500s.
- Dev DB seeding/inspection: `node -e` with `node:sqlite`'s `DatabaseSync`
  against `prisma/dev.db` works well for test fixtures; clean up after.

## The golden rule — how it's actually enforced

“Sales sees only VEEEY (formerly "EGV"), XOONX only XOONX, neither sees the other's data nor any
Trip/Traveler data.” A July 2026 security review (3 parallel code audits)
found and fixed 18 issues across 10 releases (`53dccb9` → `f36d1a0`). The map
of the enforcement, for anyone touching these areas:

- **Scope resolution helpers (pure, unit-tested):** `productScopes`,
  `requestScopes` (products/request-logic), `historyScopes` (history-logic),
  `issueVisibility`/`issueVisible` (issues-logic), `canViewUnit` (inquiry-logic,
  gates the POST-able inquiry actions), `modulesForScope` (notify-logic —
  scoped notifications can never reach the other line's operators, even if an
  admin misconfigures a rule's modules).
- **Price visibility:** `canSeeSellingPrice` (Sales/XOONX/admin) vs
  `canSeePurchasePrice` (admin/purchasing/logistics/**xoonx** — XOONX buys its
  own items so the buy price is its own cost basis; **only VEEEY Sales must
  never see buy cost**). Both enforced in UI, page props, and server actions.
- **XOONX capabilities** (all default MANAGE, admin-tunable in Settings →
  Permissions): `xoonx.deliver` (mark delivered = books revenue),
  `xoonx.editRequest` (XOONX orders are born approved), `xoonx.viewReports`
  (reports expose net profit + per-partner shares). A **delivered** order is
  un-editable until un-marked (only possible in an open month), and delivery
  is refused while every item is still REQUESTED.
- **Hard bars:** `hidesTripTraveler` (Sales-team-only users) and the issues
  module's Sales bar (`issueVisibility` returns null). History, the asset
  route (product/request photos), and the History UID search are all
  scope-partitioned.
- **Notifications:** the per-locale sender is
  `sendLocalizedCustomNotification` (notify-message-service). VEEEY pending →
  order_requests MANAGE; XOONX created/edited → xoonx MANAGE ("needs
  sourcing"); delivered → the order's creator. Actor always skipped.
- **Prod permission state (2026-07-17):** Rawan = xoonx MANAGE (the XOONX
  lead — has reports), Tarek + Abou Malek = xoonx OPERATE (no reports, by
  design), no AccessPolicy overrides. Capabilities have **no per-user
  grant** — it's user-module-level vs a global per-capability minimum.

## Business-model decisions worth knowing

- **XOONX profit partners** are an explicit `XoonxStaffShare` roster,
  deliberately decoupled from module access — don't re-tie them.
- **Carrier ≠ Courier**: Carrier = shipping company (logistics `/carriers`);
  Courier = last-mile delivery person (`/couriers`). Separate lists.
- **`/expenses` is the Operations cash ledger** — company-wide, scope-less by
  design, and must never be granted to Sales/XOONX users. XOONX finance is
  the separate `XoonxExpense` under `/xoonx/expenses`.
- Formatting is deliberately **stable, not locale-switching**: `formatEgp`,
  `formatBizDate`. Errors from validators use `err.*` i18n keys with the
  `t(error)` pattern; service-layer throws are plain English sentences.
- `RICH_EDITOR_BRIEF.md` is an *export* brief — instructions for replicating
  this repo's Tiptap editor in another project (e.g. Veeey), not a to-do.

## Open threads / natural next steps

Nothing from the security review is outstanding, and there is no undeployed
work. The known next pieces:

1. **VEEEY inbound key** — the data sync is live (catalog inbound + requests both
   ways), but the inbound API key for Veeey→YeldnIN was never generated on prod
   (`ApiIntegration.inboundKeyAt` is null). If you rely on authenticated inbound
   from Veeey, regenerate + exchange it in Settings → Integrations and confirm a
   real inbound request lands.
2. **Backup module — configure it.** Built and deployed but **disabled**; it does
   nothing until an admin enters FTPS details, tests the connection, picks
   contents + a schedule, and enables it (Settings → System → Backup). No code
   needed — this is an operator action.
3. **Transfers list polish** — friendly display name + SLA tint on the list
   (the container itself is complete).
4. Deferred-by-choice minor: service-layer throws (incl. the mark-delivered flow
   and the veto/backup services) are English-only sentences; validator errors use
   `err.*` i18n keys. Bilingual service errors would be a nice-to-have.

## How to continue

Open a new session (any Claude account), make sure this folder
(`C:\Claude\YeldnIN`) is connected, and say:

> **"Read HANDOFF.md and continue this project."**

Then, before any commit or deploy, re-check the live state (`git log`,
`git rev-parse HEAD` vs `origin/main`, and prod's `git rev-parse HEAD` +
`npx prisma migrate status` over `ssh veeey`) — other sessions may have moved
`main` or prod past what this file describes. Verification gate for any change:
`npm run typecheck` (0 errors) · `npx vitest run` · en/ar i18n key parity ·
`npm run build`. The Windows-ARM dev server can't be previewed reliably — the
production build (and, post-deploy, the live site) is the authoritative check.
