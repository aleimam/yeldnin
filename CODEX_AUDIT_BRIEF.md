# Codex Deep Audit Brief — YeldnIN

> Hand this file to Codex. It is the whole instruction set: what to audit, what
> this stack actually is, what NOT to report, how to work, and how to report.
>
> Companion doc: the Veeey storefront has its own brief at
> `C:\Claude\eCommerce\veeey\CODEX_AUDIT_BRIEF.md`. **They are different
> applications with different stacks — do not mix findings between them.**

---

## 0. Your job

Find **real defects** in this codebase, and propose **UI/UX improvements**, going
as deep as you can.

Two parts, both required:

- **Part A — Engineering.** Bugs, security holes, data-integrity risks, race
  conditions, incorrect logic, broken edge cases.
- **Part B — UI/UX.** Defects *and* enhancements: accessibility, RTL, responsive,
  state coverage, flow-level friction, microcopy.

**Depth beats breadth.** Ten confirmed, traced-through defects with file:line and
a concrete failure scenario are worth far more than fifty "consider adding a
try/catch" observations. **If you cannot describe how it breaks, do not report
it.**

---

## 1. Orientation — do this before judging any code

1. Read `CLAUDE.md` (conventions), `HANDOFF.md` (runbook + current production
   state), `APP_BLUEPRINT.md` (the spec).
2. Read `prisma/schema.prisma` end to end. The data model *is* the domain.
3. Skim `src/lib/*/**-logic.ts` — the pure, unit-tested core.
4. Run the verify gate so you know the baseline is green:
   `npm run typecheck && npm test && npm run build`

Only then start judging code.

---

## 2. Stack facts — this is NOT the Next.js in your training data

Getting these wrong produces confident, wrong findings. Check before you write.

- **Next.js 15 App Router**, RSC + **Server Actions**. Mutations are Server
  Actions, not API routes. There is no REST layer for the UI.
- **TypeScript strict.** `npm run typecheck` must stay at zero errors.
- **Prisma + SQLite, ENGINE-FREE.** `generator client { engineType = "client" }`
  (WASM query compiler) with the **`prisma-adapter-node-sqlite`** driver adapter
  over Node's built-in `node:sqlite`, wired in `src/lib/db.ts`. This is
  deliberate: the dev machine is Windows-on-ARM where the native query engine and
  `better-sqlite3` cannot load. **Do not report the adapter choice as a problem.**
- **SQLite specifics that matter:** WAL mode is on; there is no `SELECT ... FOR
  UPDATE`; concurrent writers serialise. Judge transaction/atomicity findings
  against SQLite semantics, not Postgres.
- **Custom i18n, not next-intl.** `src/i18n/{en,ar}.json` are **flat** key→string
  dicts. `getT()` server-side, `useT()`/`I18nProvider` client-side. Locale in the
  `yeldnin_locale` cookie. **en.json and ar.json must have identical key sets** —
  a missing key is a user-visible bug.
- **RTL** via `dir` plus logical properties (`ps/pe`, `ms/me`, `start/end`).
  Physical `pl/pr/ml/mr/left/right` in a directional context is a defect.
- **Hand-rolled auth**: HMAC session cookie + bcrypt. Not NextAuth.
- **Tailwind + shared utility classes** defined in `src/app/globals.css`:
  `.card`, `.btn-primary`, `.btn-secondary`, `.btn-sm`, `.input`, `.label`,
  `.th`, `.td`, `.role-badge`, `.alert-*`. Re-implementing these inline is a
  design-system defect. Brand colour is the `--brand` CSS variable (admin-set).
- Dev + prod run on port **3200**.

---

## 3. Hard constraints — violating these IS the bug

### 3.1 The golden rule (highest-yield area in this codebase)

**Scope** (`VEEEY` | `XOONX` | `PERSONAL`) is a **hard data boundary**:

- Sales sees **only VEEEY** data. XOONX staff see **only XOONX** data.
- **Neither** sees Trips/Travelers.
- A user must never learn that off-scope records exist — not via lists, counts,
  search, notifications, history, exports, error messages, or **direct-id access**.

Hunt for scope leaks everywhere, especially:
- Server Actions that check *authentication* but not *authorization* (a signed-in
  Sales user POSTing an action with a XOONX record id).
- Anything addressable **by id**: detail pages, asset/photo routes, print/export
  endpoints, inquiry/chat units.
- Aggregates: counts, badges, totals, dashboard strips, report rows.
- Notifications: recipient resolution must be scope-aware.

### 3.2 Permissions

**4 levels per user per module:** NONE / VIEW / OPERATE / MANAGE, stored in
`UserModulePermission`. Permissions are **purely per-user** — teams group people
but grant nothing. A check that infers rights from team membership is a bug.

Every mutation should be: **permission check → service → `revalidatePath` →
`redirect`**. Validation errors return `{ error }`. An action missing its guard
is a P0.

### 3.3 Other invariants

- **Soft delete** (`archivedAt`), not hard delete. Destructive operations are
  double-confirmed.
- **UIDs** are `<PREFIX><YY><MM><seq3>` allocated via the `Counter` table — check
  for races and duplicate-UID windows.
- **Money** is handled in the Pricing module; look for float drift and rounding
  applied twice.
- **Pure/service split:** `lib/<x>-logic.ts` is pure and unit-tested;
  `lib/<x>-service.ts` is `import "server-only"` and touches Prisma. Business
  rules that leak into components are a maintainability defect *and* usually a
  security one (they get re-implemented inconsistently).

---

## 4. Part A — Engineering audit

Work through these deliberately. For each, name the file and line.

1. **Authorization on every Server Action.** Enumerate every exported action in
   `src/app/**/actions.ts`. For each: is there a permission check, and is it
   *scope*-aware for the specific record being touched? Auth-only is a hole.
2. **Direct-id access paths.** Every route/handler taking an id: is the record's
   scope checked against the caller?
3. **Transaction boundaries.** Multi-step writes (order → items → pricing →
   journey; payroll; stock moves) — what happens if step 3 fails? Any state that
   can end up half-written?
4. **Counter/UID allocation** under concurrent requests.
5. **Integration endpoints** (`src/app/api/integration/**`): HMAC verification,
   timestamp/nonce replay window, idempotency-key handling, and the
   **partial-upsert** rule — a resync must never null a field the payload omits,
   and must never touch a non-VEEEY record.
6. **The backup module** (`src/lib/backup/**`): it **deletes remote files**.
   Verify the retention logic cannot delete an unparseable/foreign file, cannot
   delete the newest archive, and that a scheduled path is actually exercised
   (see §5, bug class 6).
7. **Cron/scheduled routes** (`src/app/api/cron/**`): auth via `x-cron-key`
   constant-time compare, no secret in query strings, idempotent re-entry.
8. **Error handling that hides failures**: empty `catch {}`, `.catch(() => {})`
   on something that matters, `Promise.all` swallowing a rejection.
9. **N+1 queries and unbounded reads** on list pages — this DB is SQLite; a
   missing `take` on a 16k-row table is a real problem.
10. **Dates/timezones.** Schedules are UTC; display is business-local. Look for
    off-by-one-day and DST assumptions.
11. **Secrets.** Nothing sensitive in logs, error messages, URLs, or client
    payloads. Encrypted-at-rest values must never reach the browser.

---

## 5. Bug classes already found in this codebase — look for MORE of the same

These are real defects that were fixed here. The same *class* usually recurs.

1. **Auth-without-authorization.** Actions verified the session but not the
   caller's right to *that record's scope* (inquiry unit actions, asset routes).
2. **Aggregates leaking across scope.** Counts/badges computed without the scope
   filter that the list itself applies.
3. **Stale-client payloads silently resetting stored config.** A browser holding
   an older form omits newer fields; if the server defaults them to a constant it
   **silently overwrites working settings**. Fields a stale client may omit must
   fall back to the **stored** value. (Hit twice in the backup module.)
4. **Auto-defaults clobbering deliberate values.** A control that "helpfully"
   re-defaults another field wiped a deliberately-set port. Re-default only when
   the field still holds the previous default.
5. **Incremental/cache artefacts masking errors.** A stale `tsconfig.tsbuildinfo`
   hid a real type error; a stale `.next/types` referenced a deleted route.
6. **A green manual path proving nothing about the scheduled path.** Manual and
   scheduled execution can run in *different runtimes* with different module
   resolution. Verify the scheduled path actually ran, not just the button.
7. **Exit codes masked by pipes.** `cmd | tail` takes `tail`'s status, so `set -e`
   never fires. Any script that pipes a build/test and then acts on "success" is
   broken. Check `scripts/**` and any deploy docs.
8. **Deletion logic without a floor.** Retention/prune code must never be able to
   remove the last good copy, whatever the configuration says.

---

## 6. Part B — UI/UX audit (defects **and** enhancements)

### B1. RTL & bilingual — highest-yield UI area here
- Every screen in **Arabic**. Physical padding/margin/positioning that doesn't
  flip; icons/chevrons pointing the wrong way; mixed LTR/RTL runs in one line
  (numbers, SKUs, dates, phone numbers) rendering scrambled.
- **i18n key parity**: any key in `en.json` missing from `ar.json` (or vice
  versa) — report each one. Any user-visible string hard-coded in a component
  instead of the dictionary.
- Arabic text that is machine-literal or grammatically wrong.

### B2. Design-system conformance
- Inline styling that re-implements `.card` / `.btn-primary` / `.input` / `.th`
  / `.td` / `.alert-*`.
- Hard-coded colours instead of the `--brand` variable or theme tokens.
- Inconsistent spacing/radius/typography between comparable screens.

### B3. Responsive
- Every list and form at ~375px. Tables that force horizontal page scroll (the
  table itself may scroll; the page must not).
- Sticky headers/footers overlapping content; modals taller than the viewport
  with no internal scroll.

### B4. Accessibility (target WCAG AA)
- Keyboard-only: can every action be reached and triggered? Visible focus?
- Labels tied to inputs; icon-only buttons with accessible names.
- Colour contrast, in both themes if applicable.
- Errors announced, not just coloured red.
- Destructive confirmations reachable and clearly worded.

### B5. State coverage — the project's definition of done
For every list, form and detail screen, check all five: **loading · empty ·
error · partial/permission-limited · full**. A missing empty state is a defect,
not a nice-to-have.

### B6. Flow-level UX — walk these end to end
Do them as a *user*, not as a reader of code:
1. Sign in → land → find one specific record.
2. Create a request/order through to fulfilment.
3. A Sales user and a XOONX user doing the same task — is either shown something
   they cannot act on?
4. Pricing: change an input, understand the resulting number.
5. HR: attendance → payroll for one employee.
6. Settings → Backup: configure, test, run, read the history.
7. Any destructive action: is the confirmation proportionate and reversible?

### B7. Content & microcopy
- Error messages that state what happened and what to do next, rather than
  echoing an exception.
- Buttons naming their action ("Approve request") over generic ("Submit").
- Empty states that tell the user how to fill them.

---

## 7. Do NOT report these — they are deliberate

- The engine-free Prisma setup / `node:sqlite` adapter (§2).
- SQLite instead of Postgres.
- The custom i18n system instead of next-intl.
- Hand-rolled auth instead of NextAuth.
- The `EGV` scope literal still used on the legacy request wire
  (`toWireScope`/`fromWireScope` in `src/lib/integration/request-wire.ts`) — it is
  intentionally retained until both sides re-baseline.
- Soft delete instead of hard delete.
- "Add tests" as a standalone finding. Missing coverage is only worth reporting
  when you can name the **specific untested branch that is broken**.
- Generic advice ("consider rate limiting", "add error boundaries") with no
  concrete failure path in this code.
- Style/formatting preferences.

---

## 8. Method — this is what makes it deep

1. **Trace, don't skim.** Follow one flow from the component through the action,
   the service, and into the schema. Most real bugs live at those seams.
2. **Read the schema before judging a query.** Nullability and relations decide
   whether something is a bug.
3. **Prove it.** For each finding write the concrete trigger: *"as a Sales user,
   open /requests/<a XOONX id> → the record renders"*. If you can't write that
   sentence, drop the finding.
4. **Check it isn't already handled** one layer up (middleware, layout guard,
   service-level filter) before reporting.
5. **When you find one instance of a class, grep for the rest.** One missing
   scope check usually means several.
6. **Prefer running it.** `npm run dev` (port 3200) and click, especially for
   Part B. Screenshots beat descriptions.

---

## 9. Report format

Write findings to **`CODEX_AUDIT_FINDINGS.md`** in the repo root.

### Section 1 — Defects, most severe first

```
### [P0|P1|P2] <one-line statement of the defect>
- **Where:** path/to/file.ts:123 (+ related files)
- **What happens:** the incorrect behaviour, mechanically
- **Trigger:** exact steps/state that produce it
- **Impact:** who is affected and how badly
- **Fix:** the specific change you would make
- **Confidence:** high | medium — say what you could not verify
```

Severity: **P0** data loss, security/scope breach, or money wrong · **P1** a real
user-facing break with no workaround · **P2** everything else genuinely wrong.

### Section 2 — UI/UX enhancements, by impact ÷ effort

```
### <title>
- **Screen(s):** where
- **Problem today:** what makes it worse than it should be
- **Proposal:** the change
- **Why it's worth it:** the user-visible payoff
- **Effort:** S | M | L
```

### Section 3 — Coverage log
What you examined, what you deliberately skipped, and **what you could not
verify** (no credentials, no data, needs prod). Honesty here is worth more than
padding — an audit that hides its gaps cannot be trusted.

---

## 10. The pass plan — run each as a SEPARATE session

Context runs out; a single mega-session degrades badly and starts inventing.
One pass per session, each writing its own section, appending to
`CODEX_AUDIT_FINDINGS.md`.

| # | Pass | Focus |
|---|---|---|
| 1 | Orientation + schema | Read §1 material, map the domain, list every module. No findings yet. |
| 2 | **Golden rule** | Scope leaks across every surface. Highest yield — do it early and thoroughly. |
| 3 | Server Actions | Every exported action: permission + scope check. |
| 4 | Requests / orders / fulfilment | Trace the whole lifecycle. |
| 5 | Pricing & money | Rounding, double-application, currency. |
| 6 | HR (attendance → payroll) | Correctness of computed pay. |
| 7 | Inventory / items / shipments | Stock movement, transfers, exceptions. |
| 8 | Integration endpoints | HMAC, idempotency, partial upsert, scope guard. |
| 9 | Backup module | Retention deletion safety; scheduled vs manual path. |
| 10 | Cron & background work | Auth, idempotency, failure visibility. |
| 11 | **UI/UX: RTL + i18n parity** | Every screen in Arabic. |
| 12 | **UI/UX: a11y + responsive** | Keyboard, labels, contrast, 375px. |
| 13 | **UI/UX: state coverage + flows** | The five states; the §B6 walkthroughs. |
| 14 | Synthesis | De-duplicate, re-rank by real severity, write the executive summary. |

Start each session with:

> Read `CODEX_AUDIT_BRIEF.md` in full, then run **pass N: <name>** only.
> Append your findings to `CODEX_AUDIT_FINDINGS.md` in the documented format.
> Do not start other passes.

---

## 11. Rules of engagement

- **Read-only.** Do not change application code, do not run migrations, do not
  touch the database, do not deploy. The only file you write is
  `CODEX_AUDIT_FINDINGS.md`.
- **Never touch production.** No writes against `in.yeldn.com`, no test pushes to
  the integration endpoints.
- **Never print secrets** — not from `.env`, not from the database, not into the
  findings file.
- If a finding needs a fix, **describe** the fix; do not apply it.
