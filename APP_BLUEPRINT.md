# YeldnIN — Application Blueprint (build spec)

> A complete description of the **YeldnIN** internal operations platform, written so another AI model (or engineer) can regenerate a nearly-identical application. It covers purpose, stack, architecture, the data model, every module, the core workflows, and the cross-cutting systems. Where a concrete choice matters, it is stated explicitly.
>
> **Status:** this document was regenerated from the live codebase (schema, module registry, auth layer, i18n) — it reflects what is actually built, not an earlier design generation. Companion docs carry the operational detail: `CLAUDE.md` (working rules), `HANDOFF.md` (deploy runbook + golden-rule enforcement map), and the per-feature design docs (`SUPPLY_CHAIN.md`, `INTEGRATION_V2_DELIVERIES.md`, `CHAT.md`, `DOCUMENTS.md`, `BACKUP.md`, the HR/CS docx specs).

---

## 1. What the app is

YeldnIN is the **internal back-office platform for "Yeldn Health"**, an Egypt-based company running two business lines:

- **VEEEY** — the **Veeey** storefront line (supplements, health devices). The customer-facing storefront ("Veeey", live at veeey.net / veeey.com) is a **separate application**; YeldnIN is its operations back office. *(Historical note: this scope was called "EGV" / "Egypt Vitamins"; the rename to VEEEY is complete in code, DB and UI. One legacy wire channel still speaks `"EGV"` — see §7 Integration.)*
- **XOONX** — a global "order anything from world stores" service.

The company sources products from suppliers abroad (USA / UK / EU) and brings them to Egypt largely by **travellers who physically carry items on trips**, then delivers to customers via its **own couriers** ("VEEEY Express").

The platform runs the **entire operational chain end-to-end**:

> Customer wants a product → **Sales** logs a request → (VEEEY requests pass an approval gate) → the request spawns per-unit **Items** → **Purchasing** places supplier orders → items ship to a **Hub** abroad or ride a **Trip** (a traveller carries them) → **Logistics/Operations** receive, photograph and pick up inventory in Egypt → items go "on website" → **Deliveries/Couriers** deliver to the customer. Around this run **Pricing**, **Expenses/Finance**, **Issues & Compensations**, **CS Quality**, **Human Resources**, **Documents**, **History**, **Settings**, **Users & Privileges**, and the admin **Audit/Error logs**.

It is **bilingual (English + Arabic, full RTL)**, an installable **PWA** with web push, and integrates bidirectionally with the Veeey storefront.

---

## 2. Tech stack & non-negotiable conventions

- **Framework:** **Next.js 15** (App Router), **React 19**. Heavy use of **React Server Components** + **Server Actions**; client components (`"use client"`) only where interactivity is required.
- **Language:** **TypeScript**, strict. `tsc --noEmit` must pass with 0 errors.
- **DB:** **SQLite via Prisma**, engine-free. `generator client { engineType = "client" }` (WASM query compiler, no native `.node`) over the **`prisma-adapter-node-sqlite`** driver adapter on **Node's built-in `node:sqlite`**. This is deliberate: the dev machine is **Windows-on-ARM**, where Prisma's native x64 engine can't load and `better-sqlite3`/`@libsql` have no ARM64-Windows prebuilds. **Do not switch to the native engine or better-sqlite3** unless the target is x64. Runtime DB file: `<project>/prisma/dev.db` (resolved to an absolute path in `src/lib/db.ts`); the Prisma CLI uses `DATABASE_URL="file:./dev.db"`. **WAL mode.**
- **Styling:** **Tailwind CSS** + shared utility classes (`.card`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-sm/.btn-xs`, `.input`, `.label`, `.th`, `.td`, `.role-badge`, `.alert-*`). Brand colour is the admin-settable `--brand` CSS variable. Light/dark/system colour mode.
- **Auth:** **hand-rolled** (no NextAuth). HMAC-signed session cookie (`yeldnin_session`, keyed off `SESSION_SECRET`) carrying `{ uid, tv }`; bcrypt password hashes; `tokenVersion` revocation (bumped on password change → invalidates all live tokens); per-account lockout + IP throttle. Login is a native **`POST /api/login`** route (not a server action, so browsers offer to save passwords) accepting **email _or_ username**. Email password reset via hashed, single-use, expiring tokens.
- **i18n:** **custom.** Two flat JSON dicts (`src/i18n/en.json`, `src/i18n/ar.json`) of `"key": "value"` pairs; server `getT()`, client `useT()` / `I18nProvider`. Locale in the `yeldnin_locale` cookie. **RTL** via `dir` + logical CSS props (`ps/pe`, `ms/me`, `start/end`). **EN/AR key parity is enforced** — every key exists in both files.
- **Tests:** **vitest** on pure logic only (no DB). Business rules live in dependency-free `*-logic.ts` files; DB code lives in `*-service.ts` (`import "server-only"`).
- **Money/precision:** stable formatters (`formatEgp`, `formatBizDate`) that do **not** localize digits. Cash a courier physically counts is stored as **integer piastres**, not float EGP.
- **Ports:** dev + prod internal **3200** (behind nginx in prod).

### Verification gate for every change
`rm -rf .next/types && rm -f tsconfig.tsbuildinfo` → `tsc --noEmit` 0 errors → `vitest` all green → EN/AR i18n parity → `next build` clean (never pipe the build into `tail` — it masks the exit code) → live-verify against the running app → clean up any test data. **`next lint` is a no-op** in this repo (no ESLint config).

### Architectural patterns (reproduce these)
- **Pure logic vs. service split:** `lib/<x>-logic.ts` (pure, unit-tested) + `lib/<x>-service.ts` (Prisma + `server-only`). Pages/actions call services; services call logic.
- **Server Actions** for all mutations: **permission guard → service → `revalidatePath` → `redirect`**. Validation errors return `{ error }` objects (rendered client-side), never thrown 500s.
- **Access object:** a request-scoped `Access` (`requireUser()` / `requireModule()` / `requireCapability()`) exposes `user` (incl. `tier`), `isAdmin`, `canModule(key, minLevel)`, `can(key, capability)`. Guards sit at the top of every page and action. **Authorize the STORED record, not the submitted payload**, and answer identically for "missing" and "forbidden" (a distinct message is an existence oracle across business lines).
- **UIDs:** human-readable codes via the `Counter` table — format `<PREFIX><YY><MM><seq3>` (e.g. `ITM2607001`), minted atomically by `nextUid(prefix)`. Live prefixes: `ITM` item, `REQ` request, `PUR` purchase, `PAT` patch, `TRF` transfer, `TRP` trip, `TRV` traveller, `HUB` hub, `SHP` shipment, `CAR` carrier, `CUR` courier, `DLV` delivery, `CUS` customer, `PRD` product, `ISS` issue, `EMP` employee, `DOC` document, `INQ` inquiry, `CSE` CS evaluation, `ENG` engagement, `HOL` holiday, `LV` leave, `PS` pricing.
- **Soft delete + archive** (`archivedAt`) over hard delete; **double-confirm** destructive ops.
- **Photos/assets:** an `Asset` table (blob-backed), served via an auth-gated **`/api/asset/[id]`** that resolves the owning row and default-denies unknown owners. Per-domain photo join tables (`ProductPhoto`, `RequestPhoto`, `IssuePhoto`, `DeliveryPhoto`, `EmployeePhoto`, …).

---

## 3. Access control: Tiers, per-user Module levels, Capabilities, Teams, Scope

### Modules (17 top-level areas; each is a `modules.ts` registry row + a route prefix + `module.<key>.name/.desc` i18n)
| Key | Display | Route | Category |
|---|---|---|---|
| `order_requests` | Sales | `/sales` | supply_chain |
| `xoonx` | XOONX | `/xoonx` | supply_chain |
| `purchasing` | Purchasing | `/purchasing` | supply_chain *(folded into Logistics nav)* |
| `logistics` | Logistics | `/logistics` | supply_chain |
| `operations` | Operations | `/operations` | supply_chain |
| `couriers` | **Deliveries** | `/deliveries` | supply_chain |
| `issues` | Issues & Compensations | `/issues` | supply_chain |
| `history` | History | `/history` | supply_chain |
| `pricing` | Pricing | `/pricing` | services |
| `cs_quality` | CS Quality | `/cs-quality` | people |
| `human_resources` | Human Resources | `/hr` | people |
| `expenses` | Expenses | `/expenses` | finance |
| `settings` | Settings | `/settings` | administration |
| `user_access` | Users & Privileges | `/users` | administration |
| `audit_log` | Audit Log | `/audit` | administration |
| `error_log` | Error Log | `/error-log` | administration |
| `documents` | Documents | `/documents` | administration |

> **Key vs label divergence is intentional and load-bearing:** the `couriers` module is *labelled* "Deliveries" and routes to `/deliveries` — the internal key stays `couriers` because permissions are keyed by module key in `UserModulePermission`, and renaming it would void every existing grant. The courier roster is a tab inside. `purchasing` is folded into the Logistics nav but keeps its own permission.

The home dashboard groups module cards by **category** (`supply_chain`, `services`, `people`, `finance`, `administration`); a user sees a module only if they hold ≥ VIEW on it.

### The permission model — **per-user module levels, NOT roles**
- **`User.tier`: `SUPER_ADMIN | ADMIN | MEMBER | THIRD_PARTY`.** Admin tiers (`SUPER_ADMIN`, `ADMIN`) **bypass** per-module checks (always effective `MANAGE`). `THIRD_PARTY` = an external account (supplier/partner/**courier**) that logs in but has **no employee record** (`ensureEmployee` is skipped) and is blocked from `/api/upload`.
- **4-level per-user, per-module permission:** `NONE | VIEW | OPERATE | MANAGE`, stored one row per grant in **`UserModulePermission(userId, moduleKey, level)`**. Effective level for a non-admin is exactly the stored level (default `NONE`). This is the entire authorization spine.
- **Capabilities** refine OPERATE/MANAGE within a module (e.g. `order_requests.approve`, `xoonx.deliver`, `expenses.manageAdmin`, `human_resources.manage`, `settings.managePermissions`). Each capability maps to a minimum level; `access.can(module, capability)` checks it. There is **no row-level ("only my own rows") concept** — where "own rows only" is needed (couriers, pricing history), it is enforced by an explicit query filter, not the permission system.
- **Teams** (`Team`, `TeamMember`) **group users for convenience only** — they grant **nothing**. Permissions are purely per-user.
- **Legacy RBAC tables** (`Role`, `Permission`, `RolePermission`, `UserRole`, `TeamRole`) still exist in the schema but are **DEAD** — zero runtime references outside the schema/seed. A fresh build should omit them.
- **Config-as-data:** `AccessPolicy` (capability → min-level overrides), `WorkflowConfig` (status vocab/labels/timers), `SlaConfig`, `NotificationRule` — all admin-editable rows, not code constants.
- Seed is **idempotent**; it never resets an existing admin password. Dev super-admin: `admin@yeldn.local` / `ChangeMe!2026`.

### Scope — the hard data boundary (the "golden rule")
A `scope` field of **`VEEEY | XOONX | PERSONAL`** on products, customers, requests, items, deliveries, etc.:
- **Sales sees only VEEEY; XOONX sees only XOONX; neither ever sees the other's data, nor any Trip/Traveller/supply-chain data.** This is the single most important invariant — replicate it in every list, search result, detail page, notification recipient set, and integration payload.
- **Logistics / Operations / Purchasing / Admin** are the cross-scope back office (see all operational scopes).
- Records inherit scope from their product; a free-text request falls back to the creating module's default (`order_requests → VEEEY`, `xoonx → XOONX`). **VEEEY** products/customers are largely **owned by the storefront** (the sync is the writer); XOONX/PERSONAL are fully YeldnIN-owned.
- Mutations addressed by id must **load the stored record and authorize its scope** (never trust a submitted scope); non-admins may never move a record to a scope they can't manage. The 2026-07 security audit closed 11 golden-rule defects along exactly these lines (see `HANDOFF.md`).

---

## 4. Core data model

> SQLite + Prisma, **127 models**. IDs are autoincrement ints; most entities also carry a string `uid`. Timestamps `createdAt`/`updatedAt`; soft-delete via `archivedAt`. Only `UserTier` is a real enum; other "enums" are validated strings (SQLite portability).

### The serialized `Item` core (the operational heart)
Inventory is modelled as **one `Item` row per physical unit** (not a quantity-bearing batch). Each `Item` carries its own `uid` (`ITM…`), `productId`, denormalized `scope`, `status`, a **typed container** it currently sits in, and its own timers/flags. The former carriers became thin container tables the Item points at.

- **`Item`** — `status` (12-step vocab below), `containerType` (`REQUEST | PURCHASE | PATCH | TRANSFER | TRIP | HUB | TRAVELER | SHIPMENT | ORDER`) + `containerId`, `requestId` (origin anchor for pool returns), `country` (set on receipt; drives same-country transfers), `exceptionFlag` (`LOST | DAMAGED | ERRANT | DELAYED`) + note/at/by/issue, `isSpecialOrder`, `isGift`, `sellingPrice`, `purchasePrice` + `purchaseCurrency` (XOONX: USD/GBP/EUR, EGP when null), and scheduled auto-advance timestamps (`receivedAt`, `promisedDeliveryAt`, `transitAt`, `globalShippingAt`, `slaAlertedStatus`).
- **`ItemEvent`** — append-only per-item status/movement log (the audit trail behind History).

**Item status lifecycle (`ITEM_STATUS_ORDER`):**
`REQUESTED → ORDERED → SHIPPED → DELIVERED → HUB → TRANSIT → GLOBAL_SHIPPING → CUSTOMS → OUT_FOR_DELIVERY → OFFICE → PHOTOS_SENT → WEBSITE`
(pre-receipt statuses are everything before `HUB`; labels are admin-configurable via `WorkflowConfig`; auto-advance timers move items through the transit legs).

### Containers & supply-chain entities
- **`Request`** (`REQ…`) + **`RequestLine`** — a customer wanting one or more products. VEEEY requests pass an **approval gate** (`PENDING → APPROVED → REJECTED`); approval spawns the Items. XOONX requests are born approved. Selling price + deposit visible only to Sales/XOONX/Operations/admin. Types: `SPECIAL_ORDER | OUT_OF_STOCK | RESTOCK | OPTIONAL`.
- **`Purchase`** (`PUR…`) — a placed supplier order (container `PURCHASE`), with supplier, purchase price/currency, order/tracking numbers.
- **`Patch`** (`PAT…`) — a shipment leg from a purchase to a destination (default `HUB`) via a **`Carrier`** (shipping company) with tracking; carries a scope + country.
- **`Trip`** (`TRP…`) + **`TripMark`** — a traveller's journey carrying inventory to Egypt; `TripMark` is a per-team (`PURCHASING | LOGISTICS | OPERATIONS`) `OK|ISSUE` sign-off on the trip.
- **`Traveler`** (`TRV…`) — carries items; static-address/male-support/allowed-types flags, status.
- **`Hub`** (`HUB…`) — a holding location abroad (replaces the old "Office"): name + country.
- **`Shipment`** (`SHP…`) — the per-scope split of a trip's inventory created at pickup; `status` `OFFICE → PHOTOS_SENT → WEBSITE`.
- **`Transfer`** (`TRF…`) — move inventory between locations (hub/trip/traveller).
- **`Carrier`** (`CAR…`) — a shipping **company** (logistics-gated; used by Patch/Transfer). *Distinct from `Courier` — a last-mile delivery person.*
- **`Supplier`**, **`Country`** (admin-managed table; note some pure logic still carries fixed USA/UK/EU regions for imports), **`Product`** + **`ProductPhoto`** (`sku @unique`, `scope`, type, weight, prices), **`Customer`** (`veeeyCustomerId?`).
- **`Issue`** (`ISS…`) + **`IssuePhoto`** + **`IssueItem`** — a non-blocking red flag against a supplier/trip/courier, tied to items; lifecycle + admin categories; **`Compensation`** = a 0-price compensation order.

### Deliveries (contract v2 — see `INTEGRATION_V2_DELIVERIES.md`)
- **`Delivery`** (`DLV…`) — an order going out to a customer by our own courier. **Deliberately self-contained**: `DeliveryLine` carries sku+name as *labels* (not FKs) and the customer is denormalized, because the two stores have colliding SKU spaces and overlapping customer ids. Money in **integer piastres**. `status`: `NEW → ASSIGNED → OUT_FOR_DELIVERY → {DELIVERED | RESCHEDULED | DELAYED | FAILED | CANCELLED}` (RESCHEDULED/DELAYED loop back). `reviewFlag` = the "Yellow Flag" (partial/mismatch → Ops review the order in Veeey; the sync never edits an order). **`DeliveryEvent`** = status history.
- **`Courier`** (`CUR…`) — the delivery-person roster. Optional `userId` links a **THIRD_PARTY** login account (phone in `username`, PIN as the bcrypt password). Ops staff are couriers too. **Couriers see only their own deliveries** (query-filtered; by-id 404s), enforced by tier, not permission level.

### People & support
- **Human Resources:** `Employee` (strict 1:1 with `User`) + `EmployeePhoto/Event`, `EmployeeType`, `Position`, `SalaryType`, `SalaryComponent`/`SalaryStructureLine`/`SalaryChange`, `Payslip`/`PayslipLine`, `LeaveRequest`, `Absence`, `Holiday`/`HolidayBonus`, `DayType`/`DutyDay`, `HrConfig`; **Engagement** suite (`EngagementCategory/Template/Criterion/Event/Eligible/Achievement`) for recognition/"Bounce" bonuses.
- **CS Quality:** call-quality evaluations — `CsEvaluation` + `CsEvaluationAnswer/Photo`, `CsQuestion`, `CsEvalType`, `CsVeto`, `CsRepBonus`/`CsBonusTier`, `CsConfig`.
- **Chat / Inquiry:** internal messaging — `ChatConversation`/`ChatMessage`/`ChatAttachment`; record-anchored `Inquiry`/`InquiryMessage`/`InquiryAttachment`/`InquiryDisposition`.
- **Documents:** company library — `Document`/`DocumentVersion`/`DocumentAck`/`DocumentCategory`/`DocumentPermission` (per-team ACL, Tiptap + sanitize-html).

### Pricing, Finance, Platform, Integration
- **Pricing:** `PricingCalculation` (+`PricingPhoto`), `PricingSettings` — a configurable sell-price calculator with per-calc history.
- **Expenses / Finance:** `ExpenseTransaction`/`ExpenseCategory`/`ExpenseAttachment`/`ExpenseAccount`, monthly reconciliation (`MonthlySalesReport`, `MonthlyBankCollectionReport`/`Line`, `MonthlyReconciliationNote`); **XOONX finance:** `XoonxExpense`/`XoonxExpenseCategory`, `XoonxFxRate`, `XoonxMonthClose`, `XoonxStaffShare` (the profit-split roster — an explicit partner set, decoupled from XOONX module access).
- **Platform/config:** `PlatformSettings` (app name, brand colour, logo, nav), `Module`, `ContentPage` (bilingual CMS), `AuditLog`, `ErrorLog`, `Asset`, `Counter`, `AccessPolicy`, `WorkflowConfig`, `SlaConfig`, `NotificationRule`, `NotificationMessage`/`NotificationRecipient`, `FxRateCache`.
- **Auth/PWA:** `PasswordResetToken`, `PushSubscription`.
- **Integration:** `ApiIntegration` (single VEEEY row: enabled flag + AES-256-GCM-encrypted secret + baseUrl), `OutboxEvent`, `IntegrationNonce`, `IdempotencyRecord`.
- **Backup:** `BackupConfig` + independent **`BackupTier`** rows (each with own cadence/`everyN`, contents DB|FULL, remote folder, retention) + `BackupRun`.

---

## 5. The modules in detail

### Sales (`/sales`) — scope VEEEY · *"Turn Requests into Revenue"*
Customer product **requests** (multi-line) + customers + delivery progress. VEEEY requests go through an **approval gate** before Items spawn. Product picker is a search-as-you-type list over the catalog (**cap the list high** — a low `take` silently hides new products). Selling price + deposit visible to Sales. **Never** sees trips, travellers, suppliers, purchase prices, or XOONX.

### XOONX (`/xoonx`) — scope XOONX · *"Global stores in front of your door"*
A scope-isolated sibling of Sales for the XOONX line (born-approved requests) **plus a Finance section**: expenses, reports, FX-rate admin, monthly close, and a fixed **25% staff / 75% company** profit split (`XoonxStaffShare`). FX rate of 0 is rejected. Petty-cash/bank accounts.

### Purchasing (`/purchasing`, folded into Logistics nav) · *"If it exists, we'll find it"*
Turn approved requests into **supplier orders** (`Purchase`). Per-product picker (Requested − Ordered = Remaining); ordering splits across a product's requests oldest-first; auto-group by supplier + destination. Reads requests cross-scope (read-only). Raises supplier issues.

### Logistics (`/logistics`) · *"The world is our neighborhood"*
Travellers, hubs, **trips**, **carriers**, **patches**, **transfers**, the **product catalog** (created/edited here), and inventory. Enforces trip approval, weight caps, product-type/male-support compatibility, and the same-country "stuck item" carry-over. Trip lifecycle is driven by the Item statuses + `TripMark` sign-offs (it is deliberately *not* a single monolithic status column).

### Operations (`/operations`) · *"The Heartbeat Of Business"*
Operations-only staff **lose Logistics**; they get pickup + inventory photos + incoming-shipments review, read-only products. At pickup, a trip's inventory **auto-splits into per-scope `Shipment`s** (`OFFICE → PHOTOS_SENT → WEBSITE`); ≥1 inventory photo required to advance.

### Deliveries (`/deliveries`, module key `couriers`) · *"Orders on their way to customers"*
Ops queue of outbound `Delivery` records (status tabs, Yellow-Flag + retry surfacing) with a **courier roster** tab. Ops assign a courier and drive status; couriers sign in by **phone + PIN** and see **only their own** deliveries (address/phone/COD included) via `/deliveries` and the detail page. Fed by the inbound `delivery.created` webhook; emits `delivery.tracking` on every YeldnIN-side change (§7).

### Issues & Compensations (`/issues`) · *"Every Issue Has A Solution"*
Raise an issue against a supplier / trip / courier tied to items; lifecycle + compensations (0-price orders). Visibility is scope-partitioned; **Sales is barred**. Issue notifications are filtered by each recipient's own effective visibility (no cross-line leakage).

### History (`/history`) · *"If you forget, we don't"*
Read-only archive of terminal units across the supply-chain sections; reuses each owning module's view permission **and is scope-filtered** (Sales/XOONX never get trips/transfers). Search + date range + paging; rows deep-link to detail pages.

### Pricing (`/pricing`) · *"Price Smarter, Sell Better"*
Configurable sell-price calculator (admin params/variables with history); per-calculation history; users manage their own calcs (`deleteOwn` vs `deleteAny`).

### CS Quality (`/cs-quality`) · *"Coach the team, call by call"*
Call-quality evaluations against configurable question sets, veto rules, and rep-bonus tiers; per-rep scoring/coaching.

### Human Resources (`/hr`) · *"Your people, organized"*
Full HR suite (COMPLETE): Employees → Attendance/Day-types → Salary/Payroll → Leave/Holidays → Engagement/"Bounce" bonuses → Analytics. Strict 1:1 `User ⇄ Employee`; a 4-tier permission model including the direct-manager relationship.

### Expenses (`/expenses`) · *"Nothing escapes the ledger"*
Operations cash ledger (company-wide, scope-less): transactions, accounts, money deliveries, monthly sales reconciliation.

### Documents (`/documents`, admin) · *"Company policies & papers"*
Company document library — PDF/DOC items + rich-text pages (Tiptap + sanitize-html), per-team ACL, versions, acknowledgements.

### Settings (`/settings`, admin) · *"Customize your experience"*
All configuration: appearance/branding, pages CMS (`ContentPage`; PUBLIC render at `/p/[slug]`, INTERNAL redirect to login), modules, permissions/access policy, workflow (statuses/labels/timers) + SLA, notifications rules, the storefront **Integrations** vault (encrypted secret + signed round-trip test), and **Backup** (tiers/cadence/retention, manual run + restore). Guarded by `requireSettingsAccess()` + each section's own capability.

### Users & Privileges (`/users`, admin) · *"Everything is under control"*
Accounts, tiers, per-user module levels + capabilities, teams (grouping only). Self-service account page (password change). Creating a courier login mints a THIRD_PARTY account with exactly the `couriers` permission.

### Audit Log (`/audit`) & Error Log (`/error-log`), admin
`AuditLog` = every mutation (`writeAudit(userId, module, action, entity, id, meta)`). `ErrorLog` = captured runtime errors with 30-day retention (pruned on the cron tick).

---

## 6. Status engine & propagation
- Status vocabularies (Item, and sales-facing labels) are **admin-configurable** via `WorkflowConfig` (codes + EN/AR labels + colours + order + auto-advance timer ranges).
- The **Item** is the unit of truth; a request's progress **rolls up** from its Items (least-advanced representative; terminal/exception items drop out), rendered as a `"Partially <furthest> · n/m"` badge.
- Transit legs (`TRANSIT`, `GLOBAL_SHIPPING`, `CUSTOMS`) **auto-advance** on scheduled timestamps, swept by the cron route.
- Special-order Items carry a frozen `promisedDeliveryAt`; SLA breaches raise alerts (deduped via `slaAlertedStatus`).
- Exceptions (`LOST | DAMAGED | ERRANT | DELAYED`) are **orthogonal flags**, not statuses — they auto-open an Issue and don't block the pipeline.

## 7. Cross-cutting systems
- **Search:** global + per-module, scope-filtered (a Sales search never surfaces XOONX/Issues/History rows out of scope), any-UID lookup, per-user recents.
- **Notifications:** categorized per-user messages (`NotificationMessage`/`Recipient`) + **web push** (VAPID + `web-push`, no-op if env unset), rules in `NotificationRule`; recipients always scope-filtered.
- **PWA:** branding-aware manifest, a hand-rolled service worker (**must have NO `fetch` listener** — an empty one caused an app-wide slowdown incident), an always-actionable install prompt, and the web-push enable banner.
- **Reverse-proxy safety:** auth routes emit **relative `Location` redirects** (never build an absolute URL from `req.url`/Host behind nginx).
- **Storefront integration ("Veeey"):**
  - **Transport:** shared-secret **HMAC-SHA256** (canonical `METHOD\npath\ntimestamp\nnonce\nsha256(body)`, 5-min window), nonce replay guard, `Idempotency-Key` ledger, and an **outbox** (`OutboxEvent`) drained by `/api/cron/advance` with exponential backoff. The `ApiIntegration` row's secret is AES-256-GCM encrypted off `SESSION_SECRET`; the whole integration 404s until enabled.
  - **Contract v1** (`/api/integration/v1/**`): request/product/customer sync. Each inbound handler **stamps scope VEEEY** and refuses any other — deliveries/products/customers exist only for the VEEEY line. A legacy wire shim maps internal `VEEEY` ↔ the old wire value `"EGV"`.
  - **Contract v2 — Deliveries:** inbound `POST /api/integration/v1/deliveries` (`delivery.created` → NEW) and `…/cancel` (`delivery.cancel`; already-DELIVERED/FAILED → 409); outbound `delivery.tracking` on every YeldnIN-side status change. **Echo prevention:** the inbound cancel deliberately does *not* emit tracking (Veeey originated it).
- **Backup:** independent tiers (hourly/daily/weekly + manual), each with its own cadence/`everyN`, contents (DB or full), remote folder and retention; SFTP transport to a Hetzner Storage Box (port **23**); swept by `/api/cron/backup`.
- **Audit / Error logs:** every mutation audited; runtime errors captured with retention.

## 8. UI / UX conventions
- Header: logo + app name + version, **module switcher**, global search, user/teams chip, notifications bell, language/theme/logout. Static info pages live in the **footer**.
- Module pages use a left **ModuleNav** (collapsible) / top pill nav on mobile.
- Lists render as **sortable tables on desktop, stacked cards on mobile** (no sideways scroll; `data-cards`).
- Detail pages carry permission-gated links to related records — but Sales/XOONX never get trip/traveller links.
- Price/supplier/traveller data is never shown to Sales; error messages never distinguish "missing" from "off-scope".

## 9. Non-functional
- **Security:** permission guard at every page/action; **authorize the stored record's scope** on id-addressed writes; identical responses for missing vs forbidden; rate-limited login + per-account lockout + `tokenVersion` revocation; password policy (8+ chars, letter+digit+symbol; couriers use a 4–6-digit PIN policy); secrets only in server env / encrypted at rest; XSS-safe rich text (sanitize-html allowlist). THIRD_PARTY accounts can't upload.
- **Deployment:** **Node 22** with `--experimental-sqlite`, **PM2** (`next start -p 3200` behind **nginx** + Certbot TLS), SQLite file DB in WAL. Production host `in.yeldn.com`. Deploy is **`git pull`-based**: always `git push` first and confirm `git log origin/main..main` is empty; on the server `git pull --ff-only` → `npm install` → `prisma migrate deploy` → `prisma generate` (for new models) → build **inside an `if/else` that only reloads PM2 on success** (a build that fails must never leave PM2 on a `.next` with no BUILD_ID → 502). For a migration that rebuilds a live table, stop the app briefly to release the SQLite lock, migrate, then start. `serverExternalPackages` must list native/adapter packages (`ssh2`, `@prisma/client`, …) so `next build` doesn't try to bundle a native addon.
- **Multi-session reality:** several Claude/engineer sessions work this repo concurrently; local HEAD and prod HEAD drift — always check the real git/prod state (and the full `prodHEAD..HEAD` delta) before committing or deploying, and never touch another session's uncommitted files.

## 10. Suggested build order (for a regenerating model)
1. Auth (session/bcrypt/tokenVersion/lockout) + Users + **per-user module levels** + capabilities + the Access/guard layer + Module registry + home dashboard.
2. Scope model (VEEEY/XOONX/PERSONAL) + the golden-rule plumbing (authorize stored records; identical missing/forbidden responses).
3. Product catalog + suppliers + countries + customers + reference vocabularies + the `Asset`/photo layer + `Counter`/`nextUid`.
4. The **serialized `Item` core** + `ItemEvent` + `WorkflowConfig` status engine (12-step lifecycle, timers, exceptions).
5. Sales requests (+ approval gate) + XOONX sibling; rollup/partial-status.
6. Purchasing (`Purchase`) + per-product picker + auto-group.
7. Logistics: travellers, hubs, carriers, trips (marks), patches, transfers, inventory.
8. Operations: pickup + inventory photos + per-scope `Shipment`s.
9. Issues & Compensations; Pricing; Expenses + XOONX finance.
10. History; Settings (config, CMS, workflow, SLA); Audit/Error logs; search; notifications; PWA + push; bilingual i18n + RTL.
11. Storefront integration v1 (request/product/customer sync, flagged off) + Backup module.
12. Human Resources; CS Quality; Chat/Inquiry; Documents.
13. Deliveries (contract v2): model + Ops queue + status transitions + courier phone/PIN login + inbound webhook + outbound tracking.

---

### Glossary (Yeldn-specific terms)
- **Item / Unit** — one physical unit of product; the serialized core entity carrying its own status/location/scope. Inventory = "Items in a container/location."
- **Request** — a customer's wish for product(s) (`Request` + `RequestLine`).
- **Purchase** — a placed supplier order (not a customer order).
- **Patch** — a shipment leg from a purchase to a hub via a carrier.
- **Trip** — one traveller's journey carrying inventory to Egypt.
- **Hub** — a holding location abroad.
- **Shipment** — the per-scope split of a trip's inventory at pickup.
- **Carrier** — a shipping *company* (logistics). **Courier** — a last-mile *delivery person* (Deliveries).
- **Delivery** — an order travelling to a customer by our own courier.
- **Scope** — business-line/data boundary (VEEEY / XOONX / PERSONAL).
- **Yellow Flag** — a delivery discrepancy marker that sends Ops to review the order in Veeey (the sync never edits the order).
- **VEEEY** — the Veeey storefront business line (formerly "EGV"); the storefront app itself is separate from YeldnIN.
