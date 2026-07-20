# Codex audit — merged triage (passes 1–2)

> My verdict on everything Codex has reported so far, in one place.
> Codex owns `CODEX_AUDIT_FINDINGS.md` and appends raw findings there; this file
> is the triaged, prioritised view and the fix log. Keep them separate so new
> passes never collide with triage.
>
> Last updated after pass 2. **13 of 14 passes still to run** — expect more.

---

## Status

| | Count |
|---|---|
| Pass 2 defects reported | 11 |
| Verified by me directly | 3 (all **confirmed** — none were false positives) |
| **Fixed and deployed** | **4** (`fa05d6a`) |
| Open defects | 7 |
| Pass 1 questions triaged | 9 → 4 answered, 5 real items |

**Assessment of the audit itself:** high quality. Precise line numbers, correct
mechanics, honest confidence levels, and a coverage log that states what it
could not test. I spot-checked three findings — including one that contradicts a
judgement I made myself — and all three were real, exactly as described. I am
treating the remainder as real pending spot-checks during the fix.

**Severity note:** Codex marked all 11 as P0, which flattens a real difference.
**Cross-scope writes are worse than cross-scope disclosure.** Re-ranked below.

---

## Pass 2 — defects

### ✅ FIXED — pattern 1: authorize the STORED record, not the payload (`fa05d6a`)

One root cause: the action authorised a value the **caller supplied**, then wrote
to a record it had never checked. All four now load first, authorise what is
really there, and return the **same response for missing and forbidden** —
distinguishing them is what made several of these enumeration oracles.

| # | Defect | Was |
|---|---|---|
| F2 | Product edits authorised the submitted scope | Sales could post a XOONX product id with `scope:"VEEEY"` and **overwrite + re-scope** it |
| F3 | Request accepted a customer from another scope | FK proved existence, nothing checked scope; off-scope customer persisted and rendered |
| F10 | Approve/reject never checked the record | Success-vs-not-found on any id, and off-scope PENDING rows could be approved into spawned items |
| F4 | Issue creation had no scope validation | XOONX operator created an **unscoped** issue whose own redirect 404s for them; crafted call could set `VEEEY` |

`newIssueScope` was extracted as pure logic with 4 unit tests, including the
exact reported case. Verified: typecheck · 433 tests · i18n parity · build.

> **Honest note:** F2 lives in a function I was editing hours earlier for the
> VEEEY read-only work. I did not spot the pre-existing hole beside my change.

### 🔴 OPEN — P0, cross-scope WRITE

**F1 — the request integration can export, create and overwrite non-VEEEY records.**
Outbound emits any request's customer, lines, prices and photos without
requiring VEEEY; inbound accepts any scope string and upserts by UID without
checking the stored request's scope. Crosses the boundary **in both directions**.
Shares pattern 1's root cause but reaches into the wire contract and outbound
emission, so it is its own fix (**pattern 5**) rather than a half-measure.

### 🟠 OPEN — P1, disclosure

| # | Defect | Fix pattern |
|---|---|---|
| F7 | Inquiry ITEM actions authorise the History module, not the item's scope — reveals off-scope items *and personnel*, then creates a persistent inquiry (so partly a write) | 2 |
| F5 | Generic asset endpoint serves issue and logistics photos to any signed-in user | 3 |
| F8 | Issue notifications fan VEEEY UIDs and titles out to XOONX operators | 2 |
| F6 | Global search ignores scope for Items and Issues | 2 |

> **F5 is a correction to my own work.** I built that gating tonight and reasoned
> that logistics photos were safe because Sales/XOONX lack those modules. That is
> **obscurity, not access control** — the route never checks the module, it just
> serves the bytes. I also missed that Issues is a *shared* module with per-scope
> visibility. My own audit brief warns about exactly this ("anything addressable
> by id"); I applied the rule inconsistently.

### 🟡 OPEN — P2, enumeration oracles

| # | Defect | Fix pattern |
|---|---|---|
| F9 | Request-line validation embeds off-scope **product names** in the error | 4 |
| F11 | Customer direct-id: 404 for missing vs redirect for off-scope | 4 |

---

## Remaining fix patterns

| Pattern | Covers | Note |
|---|---|---|
| **2. Module-gated but not scope-filtered queries** | F6, F7, F8 | The scope helpers (`historyScopes`, `issueVisibility`) already exist — these call sites simply don't use them. Best value next. |
| **3. Direct-id serving without owner authorisation** | F5 | Resolve every owning relation; default-deny unknown owners. |
| **4. Error messages as oracles** | F9, F11 | Identical response for missing and forbidden. |
| **5. Integration boundary** | F1 | Both directions; touches the wire contract. |

---

## Pass 1 — orientation questions, triaged

Codex flagged these as "documentation/model questions, not findings". Four are
now answered; five are real items.

### ✅ Answered

**Legacy RBAC tables are dead.** `Role`, `Permission`, `RolePermission`,
`UserRole`, `TeamRole` have **zero runtime references** outside the schema and
seed (verified). Module permissions really are purely per-user. Not a security
surface — optional schema cleanup only.

**`DeliveryJob` was deferred, not removed.** Only `Courier` master data exists
because nothing consumed it yet. Designed 2026-07-20; the contract is
`INTEGRATION_V2_DELIVERIES.md`. The `couriers` module will be relabelled
"Deliveries" (key kept, to avoid breaking permission grants).

**`Item.containerType` / inquiry `unitKind` accepting `ORDER`** belongs to that
same deferred delivery work. Currently unused vocabulary, not dead by accident.

**`BackupConfig`'s single-schedule and GFS fields are superseded.** `tiered`,
`keepHourly`, `keepDaily`, `keepWeekly`, `lastFullAt` and the single
`frequency`/`hourUtc`/`weekday`/`dayOfMonth`/`retentionKeep` no longer
participate in execution — the run path reads `BackupTier` only (since
`426d59b`). They are still written by the save path. Harmless, but they should
be dropped so nobody edits a field that does nothing.

### 📋 Real items

| Item | Verdict |
|---|---|
| **`APP_BLUEPRINT.md` is a generation out of date** — EGV naming, `/pricer`, `better-sqlite3`, 12 modules, team/role inheritance | Real doc debt, and actively misleading: it contradicts current code. Either update it or mark it explicitly historical. |
| **Polymorphic scalar links with no FK** — item containers, issue items, patch/transfer carriers, XOONX expense refs, asset ids | Real risk class: existence, scope and deletion integrity are unenforced by the DB. Deserves its own pass, not a one-line fix. |
| **Trip lifecycle has no single state machine** — split across trip-logic, Operations conversion, item status and free-form strings | Real. Reconstruct the live transition graph in the requests/operations pass before changing anything there. |
| **`Country` table vs hardcoded `USA`/`UK`/`EU`** in pure logic, with operational rows storing country strings | Real minor inconsistency; decide which is normative. |
| **HANDOFF counts drift** — doc says 123 routes / 398 tests; actual is 124 routes / **433** tests | Trivial doc fix. |

---

## For later passes

- Pass 2 covered **only** the golden rule. Transactions, UID races, workflow
  correctness, backup/cron behaviour, error handling, performance, dates,
  secrets and all UI/UX remain unexamined.
- Codex could not execute triggers (no seeded sessions, read-only). Findings are
  source-traced, which is why F8 is self-marked medium — a production
  notification-rule override could disable that path.
- When fixing, **grep for the rest of the class**. Every pattern above appeared
  in 2–4 places; one instance almost never means one bug.
