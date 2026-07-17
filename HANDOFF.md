# HANDOFF — YeldnIN operational knowledge

> Written 2026-07-17 for whoever (human or Claude) takes this project over.
> `CLAUDE.md` covers the stack + conventions; `APP_BLUEPRINT.md` the product
> spec; `DEPLOY.md` the deploy steps. This file carries everything that
> otherwise lived only in the previous assistant's session memory: the
> operational runbook with its hard-earned gotchas, the security/permission
> decisions and why they're shaped that way, and the exact current state.

## Current state (2026-07-17)

- **App version 1.18.0**, ~48k lines, 118 routes, 369 unit tests, typecheck clean.
- **Production**: live at https://in.yeldn.com, deployed at commit `f36d1a0`.
  `main` == `origin/main` == prod. No pending migrations, no undeployed work.
- All modules from the blueprint are built and deployed: supply chain
  (products/requests/purchasing/patches/transfers/shipments/hubs/trips/
  travelers/couriers/carriers/items), Pricing, Issues & Compensations,
  CS Quality (incl. vetoes), HR (complete, phases 1–5), Chat + Inquiries,
  Documents (Tiptap editor + PDF letterhead export), Expenses, History,
  notifications (in-app inbox + web push), Audit/Error logs, Settings
  (incl. VEEEY integration vault).
- Spec documents live **untracked** in the repo root on the dev machine
  (`YeldnIN Description.docx`, `Human Resources Module.docx`, `YeldnIN-CS/
  Chat/Documents/Evaluation/Notes.docx`, `PDD.docx`, `Status.xlsx`,
  `Pricing.xlsx`, product spreadsheets). They are inputs, not code — don't
  commit them, don't lose them.

## Production & deployment runbook

Target box: `204.168.129.186` (CWP + nginx; also hosts the separate `veeey`
storefront). App dir **`/home/yeldn/app`**, PM2 process **`yeldnin`**, internal
port **3200**, nginx vhost `/etc/nginx/conf.d/yeldnin-app.conf`, SSL via
Certbot. Server Node is **22.x** → `node:sqlite` needs
`NODE_OPTIONS=--experimental-sqlite` for CLI commands (`build`, `db:seed`);
the *running* process gets it from `ecosystem.config.js`.

The previous operator deployed over SSH using a key + a `veeey` host alias in
their local `~/.ssh/config`. A new operator needs their own SSH access (or a
guided deploy where the owner pastes commands).

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
7. Ops extras: the item auto-advance cron hits
   `/api/cron/advance` via root crontab with an `x-cron-key` header
   (`CRON_SECRET` in server `.env.local`). Web-push VAPID keys are also in
   server `.env.local` (gitignored, survives pulls). Uploads live in
   `./uploads` — back up with the DB.

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

“Sales sees only EGV, XOONX only XOONX, neither sees the other's data nor any
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
  own items so the buy price is its own cost basis; **only EGV Sales must
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
  `sendLocalizedCustomNotification` (notify-message-service). EGV pending →
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

Nothing from the security review is outstanding. The known next pieces:

1. **VEEEY integration, phase 2** — the Settings → Integrations vault + test
   is built (both directions, secrets encrypted off `SESSION_SECRET`); the
   actual data endpoints (especially inbound `/api/integrations/veeey`) are
   not.
2. **Transfers list polish** — friendly display name + SLA tint on the list
   (the container itself is complete).
3. Deferred-by-choice minor: the mark-delivered flow's error strings (and
   service throws generally) are English-only.
