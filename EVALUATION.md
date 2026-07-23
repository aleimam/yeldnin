# 360 Reviews — Evaluation module design

> **Status: design / sign‑off — NOT yet built.** This is the agreed specification
> derived from `YeldnIN-Evaluation.md` (the original description) plus the full
> requirements discussion. No code is written until this doc is approved *and*
> the owner says to build. Follows the app conventions in `CLAUDE.md`
> (pure‑logic + service split, Server Actions, per‑user module permissions,
> engine‑free Prisma, EN/AR i18n parity). Sibling design docs: `CHAT.md`,
> `DOCUMENTS.md`, `SUPPLY_CHAIN.md`.

## 1. Purpose

A peer‑to‑peer **360° review** module: every staff member evaluates the
colleagues they're authorised to, against admin‑defined criteria, on a 5‑point
scale. Votes are **weighted** by organisational relationship, **normalized** per
evaluator, rolled up into analytics + CSV, and turned into an **AI‑written
feedback report** per person. It runs in admin‑driven **cycles** with deadlines.

Distinct from **CS Quality** (managers scoring reps) — this is all‑staff peer
review, built standalone. New module key: **`evaluation`**.

## 2. Access & permissions

New per‑user module `evaluation` (NONE / VIEW / OPERATE / MANAGE):
- **All staff** — self‑service: do their evaluations, see *their own* results +
  released AI report (VIEW/OPERATE).
- **Admins / HR** — MANAGE: pillars/criteria, department connections, cycles,
  analytics, CSV, AI generation/approval, effort override.
- Users **never** see weights, levels, connections, rater identities, or the
  effort formula.

## 3. Data model (new)

```prisma
// ── Config: pillars & criteria ───────────────────────────────
model EvalPillar {
  id         Int      @id @default(autoincrement())
  name       String
  nameAr     String?
  sortOrder  Int      @default(0)
  archivedAt DateTime?
  criteria   EvalCriterion[]
  teams      EvalPillarTeam[]   // many-to-many: which teams (as SUBJECT) see it
}
// NOTE: "department" throughout this module = the app's `Team` (RBAC team, keys
// sales/xoonx/purchasing/logistics/operations/development…, MANY-TO-MANY via
// `TeamMember`). This is the populated, multi-membership org unit — required by
// the "multi-department → highest weight" rule. The singular `Department` model +
// `Employee.departmentId` are an unused/empty half-build and are NOT used here.
model EvalPillarTeam {           // applicability keyed off the EVALUATEE's team(s)
  pillarId Int
  teamId   Int
  @@id([pillarId, teamId])
}
model EvalCriterion {
  id         Int      @id @default(autoincrement())
  pillarId   Int
  title      String
  titleAr    String?
  text       String
  textAr     String?
  raterScope String   @default("ANY") // ANY | CONNECTED | SAME_DEPT
  sortOrder  Int      @default(0)
  archivedAt DateTime?
}

// ── Org graph + HR edits ─────────────────────────────────────
model TeamConnection {           // undirected edge between two Teams; reciprocal
  aId Int                        // Team.id, stored with aId < bId
  bId Int                        // query both directions
  @@id([aId, bId])
}
// HR: Position.gradeLevel Int?  (admin-set numeric level; higher = more senior).
//     NB the existing Position.grade is a free-text label (Junior/Senior/L3) and
//     is left untouched — gradeLevel is the new ordinal used for 360 weighting.
// HR: Employee.gender String? (MALE | FEMALE) — plain data field, NEVER sent to AI

// ── Cycles ───────────────────────────────────────────────────
model EvalCycle {
  id             Int      @id @default(autoincrement())
  uid            String   @unique      // EVC<YY><MM><seq3>
  name           String
  startedAt      DateTime @default(now())
  deadline       DateTime
  status         String   @default("OPEN") // OPEN | CLOSED
  effortWeight   Int      @default(15)      // % of overall from the Effort pillar
  aiModel        String?                    // model chosen at generation time
  createdById    Int?
  closedAt       DateTime?
  teams          EvalCycleTeam[]            // included departments
  // FREEZE at open (see §7): snapshot criteria set + each participant's dept(s)+grade
}
model EvalCycleTeam { cycleId Int; teamId Int; @@id([cycleId, teamId]) } // included teams

// ── Evaluations ──────────────────────────────────────────────
model Evaluation {               // one row per (cycle, evaluator, subject) incl. self
  id             Int      @id @default(autoincrement())
  cycleId        Int
  evaluatorEmpId Int
  subjectEmpId   Int
  isSelf         Boolean  @default(false)
  status         String   @default("PENDING") // PENDING | SUBMITTED | NA
  overallComment String?                       // required to submit (not for NA)
  submittedAt    DateTime?
  answers        EvalAnswer[]
  @@unique([cycleId, evaluatorEmpId, subjectEmpId])
}
model EvalAnswer {
  id            Int    @id @default(autoincrement())
  evaluationId  Int
  criterionId   Int
  level         Int    // 1..5
  note          String? // optional
  @@unique([evaluationId, criterionId])
}

// ── Materialized results (written at cycle CLOSE) ─────────────
model EvalResult {               // frozen scores → analytics/CSV/AI/trends all read this
  id           Int    @id @default(autoincrement())
  cycleId      Int
  subjectEmpId Int
  scope        String // OVERALL | PILLAR | CRITERION | EFFORT
  pillarId     Int?
  criterionId  Int?
  score        Float  // normalized+weighted peer aggregate (1..5), or effort/overall as %
  selfScore    Float? // subject's own rating for the self-vs-others comparison
  responses    Int    @default(0)
  @@index([cycleId, subjectEmpId])
}

// ── AI feedback + effort ─────────────────────────────────────
model EvalFeedback {
  id             Int      @id @default(autoincrement())
  cycleId        Int
  subjectEmpId   Int
  status         String   @default("NOT_GENERATED") // NOT_GENERATED|GENERATING|GENERATED|RELEASED|FAILED
  adminNote      String?  // per-employee extra context for the prompt
  draftMd        String?  // AI output (markdown)
  editedMd       String?  // admin-edited version (what the employee reads)
  model          String?
  effortCoverage Float?   // 0..1 mechanical
  effortDepth    Float?   // 0..20 AI rubric
  effortScore    Float?   // 0..100 = coverage * (depth/20) * 100
  generatedAt    DateTime?
  releasedAt     DateTime?
  error          String?
  @@unique([cycleId, subjectEmpId])
}
```

The Claude API key lives in **Settings** (encrypted via `secret-box.ts`, same
vault as VEEEY/backup), reachable as a config row; if unset, the AI section shows
"not configured" and the rest works.

## 4. Pillars, criteria & rater scope

- A **pillar** maps to one, several, or **all** teams (many‑to‑many). The set of
  pillars shown on a subject's form = the union of pillars mapped to the
  **evaluatee's** department.
- A **criterion** belongs to one pillar and inherits its team applicability, plus
  its own **rater scope** (who is close enough to judge it):
  - **ANY** — same / direct / indirect raters.
  - **CONNECTED** — same or directly‑connected only (excludes indirect).
  - **SAME_DEPT** — same department only.
- The form for *(evaluator → subject)* shows a criterion only if the pair's
  relationship (the highest, per §6) satisfies the criterion's scope.
  **Self‑evaluation always sees everything** (you're in your own department).

### Seed criteria bank (EN; AR added at seed — all admin‑editable)

Scope shown per criterion: **[A]** = Any, **[C]** = Connected, **[S]** = Same‑dept.

**Universal pillars (all teams)**
1. **Attitude & Professionalism** — Positive attitude [A] · Respect & courtesy [A] · Punctuality & presence [C] · Professional conduct [A]
2. **Communication** — Clarity [A] · Listening [A] · Responsiveness [A] · Constructive tone [A]
3. **Integrity & Accountability** — Honesty [A] · Owns outcomes [A] · Confidentiality [A] · Follows policy [A]
4. **Teamwork & Collaboration** — Helps others [A] · Shares knowledge [A] · Cross‑team cooperation [A] · Team over ego [A]
5. **Reliability & Follow‑through** — Meets deadlines [C] · Consistent quality [C] · Follow‑through [C]

**Multi‑team pillars**
6. **Job Knowledge & Competence** *(Sales, Pharmacists, Purchasing, Logistics, Ops, Dev, Mgmt)* — Role mastery [C] · Applies knowledge [C] · Keeps current [C]
7. **Initiative & Problem‑Solving** *(Purchasing, Logistics, Ops, Dev, Mgmt)* — Proactivity [C] · Problem‑solving [C] · Improvement mindset [C]
8. **Quality & Accuracy** *(Purchasing, Logistics, Ops, Pharmacists, Dev)* — Accuracy [C] · Attention to detail [C] · Thoroughness [C]

**Team‑specific pillars**
9. **Customer & Patient Care** *(Sales, Pharmacists, CS)* — Customer focus [S] · Empathy [S] · Right advice [S] · Handles complaints [S]
10. **Operational Excellence & SLA** *(Purchasing, Logistics, Operations)* — Process discipline [S] · Timeliness/SLA [S] · Efficiency [S]
11. **Leadership & People Development** *(Management)* — Direction [S] · Develops people [S] · Fair decisions [S] · Leads by example [S]
12. **Technical Craft & Delivery** *(Development)* — Technical quality [S] · Sound judgment [S] · Reliable delivery [S]

(Full one‑line `text` for each criterion is in the original discussion; seed them
verbatim, bilingual.)

## 5. Answer scale (fixed)

Outstanding = 5 · Good = 4 · Fair = 3 · Bad = 2 · Worst = 1. Criteria are
**optional** (blank = not answered). The **overall comment is required** to
submit a (non‑NA) evaluation.

## 6. Relationships & weighting

**Department relationship** from the connection graph, between the evaluator's and
subject's departments:
- **Same department** → dept weight **4**
- **Direct‑connected** (1 hop) → **2**
- **Indirect‑connected** (exactly 2 hops, not same/direct) → **1**
- 3+ hops / unconnected → **cannot evaluate**

Multi‑department employees: evaluate every pair of (evaluator dept × subject dept)
and take the **highest** resulting weight; eligibility requires at least one pair
reaching ≥ indirect.

**Level weight** from `Position.grade` (higher number = more senior):
- Evaluator **lower** than subject → **1** · **same** → **2** · **higher** → **4**
- No grade set → treat as **same (2)**.

**Final vote weight = level × dept** (multiply). Grid:

| | Same (×4) | Direct (×2) | Indirect (×1) |
|---|---|---|---|
| Higher (×4) | 16 | 8 | 4 |
| Same (×2) | 8 | 4 | 2 |
| Lower (×1) | 4 | 2 | 1 |

Pressure‑tested: in a healthy pool the top single rater lands ~17–29 % of
influence; same‑dept peers collectively carry the majority (intended). The 16×
ceiling only concentrates on **thin data**, which is handled by the sufficiency
floor + dominant‑rater flag (§10). Keep scales; hold a **40 % per‑rater cap** and
**trimmed mean** in reserve.

## 7. Cycle lifecycle

- **One open cycle at a time.** Admin creates it with name, deadline, and the
  **included teams**; may extend the deadline; closes it (or it closes at
  deadline — admin can still extend).
- **Freeze at open:** snapshot the active pillars/criteria (incl. applicability +
  rater scope) and each participant's **department(s) + grade** into the cycle, so
  later admin edits only affect *future* cycles.
- **Population:** **Staff (payroll employee types) only** within the included
  teams. Everyone is both evaluator and subject, **including self**.
- **Completion:** an evaluator is complete when every eligible subject is either
  **submitted** or **N/A**, including their own self‑evaluation. Zero‑eligible
  evaluators auto‑complete.
- **Reminders (fixed default; configurable later):** on open → every 3 days to
  anyone incomplete → daily in the final 3 days → a final nudge at the deadline.

## 8. The evaluate flow

Per subject: the applicable pillars (by the subject's dept) → the criteria whose
rater scope this pair satisfies → optional 1–5 answers (+ optional per‑criterion
note) → **required overall comment**. **N/A** skips a whole person. Editable until
the deadline; partial completions **still count**. Employee "My 360" groups the
eligible list by department with a progress bar, plus their **self‑evaluation**.

## 9. Scoring engine

Order: **normalize → weight → aggregate by criterion → roll up**.

1. **Normalize per evaluator** (removes leniency/harshness). Pool = **all** of an
   evaluator's criterion answers across all subjects **excluding self**. If they
   answered **< 10** answers total → use raw (small‑sample floor). Else
   `scale = 4 / evaluatorMean`; every answer × scale. **No clamp** (may exceed 5 /
   drop below 1).
2. **Weight** each vote by `level × dept` (§6), snapshotted from the frozen cycle
   data.
3. **Criterion score** for a subject = `Σ(normalized × weight) / Σ(weight)` over
   raters who could see + answered it.
4. **Roll‑up by criterion scores:** pillar = mean of its criteria; overall = mean
   of criterion scores. (Roll‑up is on criteria, not mean‑of‑pillars.)
5. **Self** is shown side‑by‑side, **excluded** from the aggregate and from
   normalization.
6. **Effort pillar** blended at the very end (§11).

**Worked example.** Rater E marks subject T on *Clarity* = Good (4). E's peer mean
= 3.2 → normalized 4 × (4/3.2) = **5.0**. E is direct‑connected (×2) and higher
grade (×4) → weight **8**. T's *Clarity* = Σ(norm×wt)/Σ(wt) over all raters. If E
is one of a healthy pool (total weight 95), E's vote is ~8/95 ≈ 8 % of that
criterion — no single voice dominates.

## 10. Analytics, sufficiency & fairness

- **Materialized at close** into `EvalResult`; analytics, CSV, AI, and trends all
  read the frozen snapshot.
- **Admins** see all: per **employee** / per **department** / **all‑staff**, each
  by **criterion → pillar → overall**, with **response counts**. **Employees** see
  **their own** aggregate + **self‑vs‑others** + released AI report.
- **Sufficiency floor:** a pillar/criterion score with **< 3 raters** shows
  "provisional / insufficient data" (admin still sees numbers, flagged; employee
  view marks it provisional).
- **Cross‑cycle trends:** overall + per‑pillar over time (per‑criterion only in
  the admin drill‑down), lined up by stable pillar/criterion **ID** with gaps
  where a thing didn't exist; **▲/▼ vs previous cycle** + most‑improved/declined
  callouts; employees see their own trend incl. self‑vs‑others over time.
  Normalization re‑anchors each cycle to mean 4, which is what makes cross‑cycle
  comparison valid.
- **Anti‑gaming (advisory admin flags, flag‑only for now):** straight‑liner ·
  low‑effort · reciprocal‑high pair (collusion) · targeted outlier
  (bias/retaliation) · dominant rater (thin‑data). No silent score‑tampering;
  trimmed‑mean / weight‑cap held in reserve.
- **CSV export:** long form — one row per **evaluator → subject → criterion**
  (score + note + the overall comment). Evaluator **named** for now (anonymize
  later).

## 11. Evaluation Effort pillar (15 % of overall)

Rewards evaluating peers thoroughly — and thereby raises everyone's data quality.
A **computed** pillar (not peer‑rated), from the employee's own activity as an
evaluator this cycle, self‑eval excluded:

- **Coverage** (mechanical, fair): fraction of the employee's *eligible* peers
  they actually evaluated (submitted, not N/A) → `0..1`.
- **Depth** (AI rubric, `0..20`): average quality/insightfulness of their comments
  (specificity, constructiveness, usefulness) — ignores padding/filler.
- **Effort% = Coverage × (Depth / 20) × 100.** Neutral fallback if the employee
  had very few eligible peers. Admin can **review/override**.
- **Overall% = 0.85 × peer% + 0.15 × Effort%**, where `peer% = peerAggregate/5 ×
  100` (display clamped to 100). Blended at the roll‑up; Effort is not normalized
  or weighted.
- **Communicate its existence** to staff ("how thoroughly you evaluate others
  counts toward your own score"); **keep the exact formula hidden**.

## 12. AI feedback report

After close, an admin clicks **Generate** → a throttled **background batch** over
all included staff, each producing **two** Claude outputs: the **feedback report**
and the **effort depth** score. Per‑employee **status** (pending → generating →
generated → failed; retryable). English, low temperature.

**Lifecycle:** *Generated (draft)* → admin **edits** (plain markdown editor) /
**regenerates** / adds per‑employee context → **Approves & Releases** → visible to
the employee. Only released reports are employee‑visible. **PDF download** renders
a compact **numeric pillar‑scores table** above the narrative onto the existing
**Documents letterhead** (pdf‑lib pipeline). Employee is **notified on release**.

**Report template (2nd person, ~1 page, markdown):** Overall summary → Strengths →
Areas to improve → Pillar‑by‑pillar notes → Self vs others → Progress since last
cycle.

**Model input (all anonymized):** subject first name (greeting) + department +
applicable pillars; this cycle's per‑criterion & per‑pillar aggregates + response
counts + overall; the subject's self‑eval; the list of overall comments (author
stripped); prior‑cycle overall + per‑pillar; the admin's per‑employee note (as
**context**, never overriding the rules). **Never sent:** rater identities/roles,
**gender**, weights/levels, individual votes.

**Guardrails (system prompt + admin review backstop):** use only provided data
(never invent incidents/examples/names/numbers); never identify/guess raters;
never reference gender/age/nationality/religion/appearance/health; constructive
framing, never demeaning; acknowledge sparse/contradictory data honestly; **no
promote/dismiss/pay recommendations** — developmental only; may **summarize
comment themes with light paraphrase, never verbatim quotes**; stay within
template + length; valid markdown.

## 13. Screens

Routes under `/evaluation/*`; module sidebar shows self‑service to everyone, admin
sections gated by MANAGE. Mobile‑first, RTL/bilingual, `AppShell` + cards.

**Employee — "My 360" (self‑service)**
- **Landing (`/evaluation`)** — one status card: open cycle → name, deadline
  countdown, progress bar ("12/20 done"), **Continue evaluating**; else the latest
  Results + released report.
- **Evaluate list (`/evaluation/evaluate`)** — eligible people **grouped by
  department name** (neutral — never labelled same/connected/indirect, so
  weighting stays hidden), searchable, with a status chip each (Not started / In
  progress / **Done** / N/A). **"You — self‑evaluation"** pinned on top; progress
  bar at the top.
- **Evaluate form (`/evaluation/evaluate/[subject]`)** — one page per person:
  header (name / avatar / dept) + a prominent **"I can't evaluate this person
  (N/A)"** toggle that collapses the form. Applicable pillars → scope‑visible
  criteria, each rated with a **5‑star input** (1★ Worst → 5★ Outstanding; the
  label shows as you pick; clearable back to unrated since criteria are optional)
  + an optional per‑criterion note. **Overall comment required.** **Autosave**;
  a person is **Done** once the comment is saved (comment‑only is valid); editable
  until the deadline; **Prev / Next person** navigation.
- **My Results (`/evaluation/results/[cycle]`)** — after close: **Overall** card
  (% + ▲/▼ vs last cycle); **Self vs Others** as a **radar / spider chart** across
  pillars (your polygon vs the others' polygon — *a new SVG chart component*);
  per‑pillar breakdown + response counts + trend sparkline (provisional < 3
  raters); **Effort** as its own line; cross‑cycle **trend** + most‑improved/
  declined; the **released report** (rendered markdown + **Download PDF**) or
  "being prepared." Never shows weights, levels, rater names, or individual
  comments.

**Admin (MANAGE)**
- **Cycles (`/evaluation/cycles`)** — list + **Create** (name, deadline, included
  teams, effort weight); detail = **completion dashboard** (each participant's
  done/incomplete + % of their people evaluated) + Extend / Close + links to
  Analytics + Feedback.
- **Pillars & Criteria (`/evaluation/criteria`)** — pillars (reorder / archive) +
  team applicability (multi‑select departments); per criterion: title/text EN/AR +
  rater scope + order.
- **Analytics (`/evaluation/analytics`)** — cycle picker + cross‑cycle toggle;
  scopes **All‑staff / By department / By employee** (full breakdown, radar
  self‑vs‑others, trend, response counts, admin‑only rater list + comments +
  **fairness flags**); **CSV export** (long form).
- **Feedback queue (`/evaluation/feedback`)** — after close: **Generate** batch →
  per‑employee status; view draft → **markdown edit (edit‑then‑render)** → admin
  note → **Regenerate** → **Approve & Release**; **Effort override**; bulk
  generate / release.

**HR (the P0 edits — live in the HR module, not here)** — Department detail:
reciprocal **connected departments** (adding B to A auto‑adds A to B); Positions:
**grade**; Employee form: **gender**.

**Settings** — Claude API key (Settings → Integrations, encrypted vault).

## 14. Phased build plan

- **P0 — HR prerequisites:** `Position.grade`, `Employee.gender`, Department
  connections + reciprocal graph + admin UI. Migration.
- **P1 — Config:** pillars/criteria (M2M teams + rater scope) admin CRUD + seed
  bank (EN/AR). Migration.
- **P2 — Cycle + evaluate:** eligibility engine (pure + tests) from the graph;
  cycle create/extend/close + **freeze at open**; evaluate form + N/A + self‑eval
  + submit + completion + reminders.
- **P3 — Scoring + analytics:** normalization + weighting (pure, unit‑tested);
  materialize `EvalResult` at close; analytics (employee/dept/company, roll‑up,
  response counts, sufficiency floor) + self‑vs‑others + cross‑cycle trends +
  fairness flags + CSV. (Effort **coverage** computed here.)
- **P4 — Notifications + polish:** release/complete/deadline notifications, i18n
  parity, verify (typecheck / tests / build).
- **P5 — AI feedback + Effort depth:** Claude API key (Settings vault); background
  batch → report + effort depth; draft→edit→approve→release; markdown editor;
  letterhead PDF; blend Effort (15 %) into overall.

Each phase ends on the standard gate: `npm run typecheck` (0) · `npx vitest run` ·
EN/AR key parity · `npm run build`, then commit; deploy per `HANDOFF.md`
(P0/P1/P2/P5 carry migrations; P5 adds no new npm dep — Claude via `fetch`).

## 15. Deferred by choice (log)

- Full rater **anonymity to admin** (admins currently see evaluator names).
- **40 % per‑rater weight cap** and **trimmed mean** — reserve, add only if
  fairness flags show real gaming.
- **Manager mid‑tier view** (today: admins see all, everyone else only their own).
- **Configurable reminder cadence** (fixed default now).
- **Multi‑provider AI / per‑generation model choice UI** (Claude only; Sonnet
  default, Opus premium).
- Optional one‑line Effort nudge inside the report (kept out of the narrative for
  now; Effort surfaces as a pillar/number).
