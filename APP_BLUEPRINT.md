# YeldnIN — Application Blueprint (build spec)

> A complete description of the **YeldnIN** internal operations platform, written so another AI model can regenerate a nearly-identical application. It covers purpose, stack, architecture, data model, every module, the core workflows, and the cross-cutting systems. Where a concrete choice matters, it is stated explicitly.

---

## 1. What the app is

YeldnIN is the **internal back-office platform for "Yeldn Health"**, an Egypt-based company that sells vitamins, supplements and health devices (brand: *Egypt Vitamins / EGV*) plus a second business line called **XOONX** (a global "order anything from world stores" service). The company sources products from suppliers abroad (USA / UK / EU) and brings them to Egypt mainly by **travellers who physically carry items on trips**, then delivers to customers via its own couriers.

The platform runs the **entire operational chain end-to-end**:

> Customer wants a product → **Sales** logs a request → **Purchasing** places supplier orders → items ship to an **Office** abroad or are assigned to a **Trip** (a traveller carries them) → **Logistics/Operations** receive, photograph and pick up the inventory in Egypt → items go "on website" → **Couriers** deliver to the customer. Around this run **Pricing**, **Expenses/Finance**, **Issues & Compensations**, **History**, **Settings**, and **Users & Privileges**.

It is **bilingual (English + Arabic, full RTL)**, an installable **PWA** with web push, and integrates with an external storefront ("Veeey").

---

## 2. Tech stack & non-negotiable conventions

- **Framework:** Next.js 15 (App Router). Heavy use of **React Server Components** + **Server Actions** (form `action={serverAction}`); few client components (only where interactivity is required, marked `"use client"`).
- **Language:** TypeScript everywhere. Strict-ish; `tsc --noEmit` must pass with 0 errors.
- **DB:** SQLite via **Prisma** using the **better-sqlite3 driver adapter** (no native query engine; `engineType="client"` — chosen for Windows/ARM compatibility). Runtime DB path is hardcoded to `<cwd>/prisma/dev.db`. The Prisma CLI uses `DATABASE_URL="file:./dev.db"`.
- **Styling:** Tailwind CSS. A small set of shared utility classes (`.card`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.input`, `.label`, `.th`, `.td`). Dark mode via `dark:` variants. Brand color is a CSS variable driven by admin settings.
- **Auth:** hand-rolled. Session cookie (HMAC-signed with `SESSION_SECRET`), bcrypt password hashes. **No NextAuth.** A native `POST /api/login` route (not a server action) so browsers offer to save passwords. Email password reset with hashed, single-use, expiring tokens.
- **i18n:** custom. Two JSON dictionaries (`src/i18n/en.json`, `src/i18n/ar.json`) of flat `"key": "value"` pairs, a server helper `getT()` and a client `useT()` / `I18nProvider`. Locale stored in a cookie. RTL handled with logical CSS props (`ps-`, `pe-`, `ms-`, `me-`, `start/end`) and `dir`.
- **Tests:** **vitest** for pure logic (no DB). Business rules are extracted into pure, dependency-free `*-logic.ts` files that are unit-tested; DB-touching code lives in `*-service.ts` (`import "server-only"`).
- **Money/precision:** all monetary aggregates rounded to 2 decimals at boundaries.
- **Verification gate for every change:** `tsc` 0 → `vitest` all green → `next build` clean → live-verify → clean up test data.

### Architectural patterns (reproduce these)
- **Pure logic vs. service split:** `lib/<x>-logic.ts` (pure, tested) + `lib/<x>-service.ts` (Prisma + `server-only`). Pages/actions call services; services call logic.
- **Server Actions** for all mutations; they `requirePermission(...)`, mutate via a service, `revalidatePath(...)`, then `redirect(...)`. Validation errors come back via `useActionState` result objects (`{ error }`), not thrown 500s.
- **Access object:** a request-scoped `Access` (`getAccess()` / `requirePermission()`) exposes `user`, `isAdmin`, `can(permission)`, `canAccessModule(moduleKey)`. Guards live at the top of every page and action.
- **UIDs:** human-readable codes via a per-prefix, per-month counter. Format `<PREFIX><YY><MM><seq3>` (e.g. `O2606001`). Prefixes: `O` order-request, `ORD` order(batch), `S` trip/shipment, `G` group, `OG` order-group, `T` traveller, `TR` transfer, `DJ` delivery-job. Allocated atomically inside the mutating transaction via `nextUid(prefix, tx)`.
- **"Save all" pattern:** multi-row edit screens use one bottom "Save all" button (HTML form-attribute batching), not per-row saves.
- **Soft delete + archive:** most entities archive (recoverable from Settings → Archive) rather than hard-delete; permanent delete is super-admin only and double-confirmed (type the UID).
- **Double-confirm destructive actions** globally (a `ConfirmSubmit` component; `once` for simple, UID-typed for permanent).
- **Photos/docs:** a polymorphic `SupplyAttachment { entityType, entityId, mimeType, ... }` table; served via `/api/supply-attachment/[id]`. A reusable `ImageUpload` (drag/drop/paste) + `ImageZoom` + `NoteThumbs`.

---

## 3. Access control: Modules, Permissions, Roles, Teams, Scopes

### Modules (the app's top-level areas; each is a registry row + a route prefix)
| Key | Display | Route | Section |
|---|---|---|---|
| `egv_pricer` | Pricing | `/pricer` | main |
| `order_requests` | Sales | `/sales` | main |
| `xoonx` | XOONX | `/xoonx` | main |
| `purchasing` | Purchasing | `/purchasing` | main |
| `logistics` | Logistics | `/logistics` | main |
| `operations` | Operations | `/operations` | main |
| `couriers` | Couriers | `/couriers` | main |
| `issues` | Issues & Compensations | `/issues` | main |
| `history` | History | `/history` | main |
| `expenses` | Expenses | `/expenses` | main |
| `settings` | Settings | `/settings` | admin |
| `user_access` | Users & Privileges | `/users` | admin |

The home dashboard shows a **card grid** of the modules a user can access, each with a name and a short **tagline** (`module.<key>.name` / `.desc` i18n keys). A user only sees a module if they hold a non-trivial permission for it.

### RBAC graph
- `User` (tier: `SUPER_ADMIN | ADMIN | MEMBER`) — admins bypass permission checks.
- `Permission` (string keys grouped by module, e.g. `logistics.trip.manage`, `purchasing.manage`, `orders.request.create`).
- `Role` → `RolePermission[]`; `User` → `UserRole[]`; also `Team` → `TeamMember[]` + `TeamRole[]` (a user inherits their teams' roles).
- Every module ships an **Admin** role and a **User** role (e.g. "Logistics Admin"/"Logistics User", "Pricing Admin"/"Pricing User", "Issues Admin", "Operations Admin", "Purchasing Admin").
- Seeded idempotently. The seed **never resets an existing admin password** (only creates the default `admin` if none exists).

### Scope (a hard data boundary — the "golden condition")
A `scope` field on products/requests/customers/orders: **`EGV`**, **`XOONX`**, **`PERSONAL`**. Rules:
- **Sales sees only EGV; XOONX sees only XOONX; neither ever sees the other's data, nor any Trip/Traveller data.** This is the single most important invariant — replicate it everywhere (lists, search autocomplete, detail pages, connections, order/trip names).
- Logistics/Operations/Purchasing/Admin are the cross-scope back office (see all).
- Records inherit scope from their product; a free-text request falls back to the creating module's default scope (`order_requests→EGV`, `xoonx→XOONX`, others→EGV).
- Mutations addressed by id take an `expectedScope` and call `assertScope(...)` so a user can't write across scopes (IDOR protection). Non-admins may never change a record's scope.

---

## 4. Core data model (key entities & fields)

> SQLite + Prisma. IDs are autoincrement ints; most entities also have a string `uid`. Timestamps `createdAt`/`updatedAt`; soft-delete via `archivedAt`/`archivedById`.

> **⚠ Architecture direction — the per-unit Item model.** The operational core is being re-architected around a serialized **`Item`** (one row per *physical unit* of product), with the former carriers (**request, order, trip, office, traveler, shipment**) becoming thin references. Each `Item` carries its own `uid`, `productNameSnapshot`, `scope`, `statusCode`, current location (`officeId` / `tripId` / etc.) and movement history; status logic lives in pure `lib/item/item-status.ts` (`statusProps(code)` → `{ problem, deductsStock, terminal }`) and `lib/item/item-service.ts` (`getTripItems`, status vocab, moves). Items are viewed at `/items/units/[id]`. **A fresh build should model inventory as per-unit Items from the start** (cleaner than the original quantity-bearing "Batch"): an *order* becomes a set of Items; a *trip* simply references the Items assigned to it; office/traveler inventory is "Items whose location = that office/traveler." The sections below describe the **business domain** (stable) using the original Batch terminology where the rebuild is still in flight — treat "an Order/Batch with quantity N" as "N Items."

- **Product** — catalog item. `name @unique`, `scope`, `sku @unique?` (canonical key shared with the storefront; required for new EGV products), `productTypeId`, `maleSupport` (bool flag), `estimatedWeight` (grams), `defaultSupplierId`, `defaultUrl`, `purchasePrice?` (optional reference price, Purchasing/Logistics-only, prefills the order form), `size`, `grade`, `concentration`, `imageUrl`, `notes`.
- **ProductType** (Supplements, Heavy Supplements, Devices, Injection, XOONX, …; `countsTowardWeight` flag), **CustomerChannel**, **Priority** (urgency; some require an SLA/deadline; an "Optional/lowest" priority with no deadline), **Scope**.
- **Customer** — `name`, `contact`, `channel`, `scope`, `veeeyCustomerId?`. Customer notes-with-photos.
- **OrderRequest** ("Request") — a customer wanting **one** product. `uid` (`O…`), `scope`, `productId?` + `productNameSnapshot`, `quantityRequested`, `customerId?`, `priorityKey`, **selling price + deposit** (visible only to Sales/XOONX/Operations/admin via `canViewSellPrices`), `salesStatusCode` + `internalStatusCode`, `deliveredToCustomerAt`, snapshots of product type/weight/male-support for downstream rules, `groupId?`.
- **OrderGroup / RequestGroup** — bundles requests. `scope` here means the **type**: `CUSTOMER` (special-order, keeps a deposit) or `SUPPLIER` (restock). Auto-group within a 6h window by customer (special) or supplier (restock); manual "group any request"; logistics sees groups read-only.
- **Batch ("Order")** — a **placed supplier order**. `uid` (`ORD…`, nullable-unique; legacy rows null → display `#id`), `requestId`, `scope`, `kind` (`ORDER | GIFT`), `quantity`, `supplierId`, `purchasePrice`, `currency`, `orderNumber`, `courierId?`, `trackingNumber`, `statusCode`, `locationType` (`SUPPLIER|OFFICE|TRAVELER|OPERATIONS|CUSTOMER|LOST`), `currentOfficeId? / currentTravelerId? / tripId?` (mutually-exclusive destination), `stuckAt?` (missed/late item held by traveller), `orderGroupId?`, gift fields (`giftProductId?`, `giftName?`), compensation fields (`isCompensation`, `compensationForIssueId?`, `compensatorType/Id`).
- **SupplyChainSupplier** (`country`, `type` incl. MANUFACTURER), **HandlingFee** (polymorphic `BATCH|TRANSFER`, added anytime by logistics/ops/purchasing).
- **Traveler** — carries items. `uid` (`T…`), `name`, `contact`, `hasStaticAddress`, `allowsMaleSupport`, `defaultAddress`, `referenceTravelerId?`, `generalNotes`, `status` (ACTIVE/INACTIVE/BLACKLISTED), `allowedTypes` (ProductType[]).
- **Office** — a hub abroad. `name`, `region` (= country USA/UK/EU), `status`, `hiddenAt?`, notes.
- **Trip** ("shipment/deal") — items a traveller carries on one journey. `uid` (`S…`), `travelerId`, `lastReceivingDate` (last day the office abroad accepts items for this trip — **required, must be future**), `deliveryDateEgypt` (**required**), `maxWeight` (kg), `dealPricePerKg`, `country`, `allowsMaleSupport`, `notes` (a.k.a. "Conditions", prefilled from the traveller's `generalNotes`), `allowedTypes`, `statusCode`, `reviewResumeStatus?`, `delayedAt?` (orthogonal health flag), approval fields. **Rule: one trip per traveller per last-receiving day.** Friendly display name = `"<Traveller> · <DD Mon>"`; raw UID shown only on the trip detail page.
- **TripCost**, **TripApproval**, **Shipment** (per-scope split of a trip's inventory created at pickup; statuses to "Sent Photos" → "In Website"), **InventoryLot** (child of Batch: per-unit expiry `MM/YYYY` + batch number; lots sum ≤ batch qty; optional with a ⚠ "missing" badge).
- **ProductMovement** — append-only movement/status log per batch (the audit trail powering history tables).
- **Issue** — unified across sources. `scope/source` (`SUPPLIER | TRIP | COURIER`), linked `requestId?/batchId?/tripId?`, `type` (admin-extendable categories: LOST_ITEM, …), lifecycle (`Open → FollowUp → Closed` with admin-managed follow-up & closure reason lists), `IssueItem[]`. Issues are a **non-blocking red flag** (no separate HAS_ISSUE status). **Issue Groups** bundle same-supplier issues.
- **Compensation** — a 0-price compensation order (linked to an issue or standalone), provided by supplier/courier/traveller.
- **DeliveryJob** (Couriers) — `uid` (`DJ…`), customer/address/area, assigned courier, status (`NEW→ASSIGNED→…→DELIVERED/POSTPONED` with required reasons), cash collection. **Courier** users + role; mobile "My Deliveries".
- **Transfer** — move inventory office/trip → office/trip. `uid` (`TR…`), from/to, items, statuses `NEW→SHIPPED→DELIVERED→RECEIVED` (items land at destination on RECEIVED).
- **WorkflowStatus** — configurable status vocabularies (separate scopes: ORDER, PRODUCT, SALES, TRIP, INTERNAL), `code`, `label`, `color`, `sortOrder`, mapping (`salesStatusCode`), auto/event rules. A **Remap** admin tool re-points orphaned codes after vocabulary edits.
- **Notification** (category + priority + color, per-user), **TimelineNote** (+ attachments), **SearchHistory** (per-user recents).
- **Pricing engine:** `Parameter`, `ParameterHistory`, `OptionList`, `Option`, `Counter` (also the UID counter table).
- **Finance (XOONX):** `XoonxExpense`, `XoonxExpenseCategory`, `FxRate` (monthly USD/GBP/EUR), `MonthClose`, `XoonxStaffShare`, `ExpenseCategory`, `RevenueEvent`.
- **Platform/config:** `PlatformSettings` (app name, brand color, logo, nav layout), `SupplyChainSettings`, `OrderFieldConfig` (dynamic request fields), `ContentPage` (static CMS pages), `Module`, RBAC tables.
- **Auth/PWA/integration:** `PasswordResetToken`, `PushSubscription`, plus HMAC machine-client config for the storefront integration.

---

## 5. The modules in detail

### Pricing (`/pricer`)
A configurable **pricing calculator** for supplements & devices. Admin-managed parameters (margins, fees, FX, shipping factors) with change history; option lists feed dropdowns. Produces a sell price from inputs. Has its own calculation **history** (kept at `/pricer/history`). Roles: Pricing User/Admin. Tagline: *"Price Smarter, Sell Better."*

### Sales (`/sales`) — scope EGV
Customer **product requests** + **special-order groups** + **customers** + delivery progress. Create a request (product picker is a search-as-you-type datalist over the catalog; **cap the product list high — a `take` that's too low silently hides newly-added products**). Selling price + deposit (visible to Sales). "Partially `<furthest>` · n/m" rollup badge per request from its orders. "+Add Request" from a customer or product page (locks that customer/product). Sales **never** sees trips, travellers, suppliers, purchase prices, or XOONX. Tagline: *"Turn Requests into Revenue."*

### XOONX (`/xoonx`) — scope XOONX
A **parameterized clone of Sales** for the XOONX line (different deposit %, scope-isolated) **plus a Finance section**: expenses, reports, FX-rate admin, profit split. Net profit = revenue (delivered selling prices) − costs (purchasing + handling + global shipping + local). Fixed **25% staff / 75% company** split (staff pool per `XoonxStaffShare`). Live **Petty Cash** (auto-refill on close) + **Bank**. **Close Month** (≥7 days, locks selling-price edits, snapshots). FX rate of 0 is rejected (it would silently zero foreign costs). Tagline: *"Global stores in front of your door."*

### Purchasing (`/purchasing`)
Turn requests into **supplier orders**. A **per-product order picker** shows each orderable product once with `Name (Requested − Ordered [+ Problems] = Remaining)`; ordering **splits across that product's requests oldest-first**. Orders **auto-group** by supplier + destination within 6h (MANUFACTURER suppliers don't auto-group — suggest manual). Purchase price required at order time (0 allowed). **Place-order shortcuts:** a button on a request's detail page and on a product's detail page opens the order form with that product pre-selected (only while there are items left to order). Reads requests cross-scope (read-only) and raises supplier complaints (Issues). Tagline: *"If it exists, we'll find it."*

### Logistics (`/logistics`)
Travellers, offices, **trips**, transfers, the **product catalog** (create/edit here), and inventory. **Trip lifecycle:** `NEW → APPROVED (admin) → STARTED_SHIPPING → COMPLETED_SHIPPING → RECEIVED_BY_TRAVELER → IN_EGYPT → READY_TO_PICKUP → PICKED_UP → REVISED_BY_OPS → REVISED_BY_LOGISTICS → COMPLETED`. Rules: a trip is frozen until an admin approves; can't reach "In Egypt+" before its delivery date (admin override); closes to new orders once shipping completes or last-receiving date passes; weight cap enforced (product grams × qty vs. trip `maxWeight` kg); product-type & male-support compatibility enforced when assigning. "Delayed" is an **orthogonal flag** auto-set after delivery-date + grace. **Traveller-based inventory:** items assigned to a trip belong to the traveller; missed/late items become "Stuck" and are carried by that traveller's next same-country trip. Tagline: *"The world is our neighborhood."*

### Operations (`/operations`)
Operations-only staff **lose the Logistics module**; they get **pickup + inventory photos + incoming-shipments review**, and read-only products. At "Picked Up" a trip's inventory **auto-splits into per-scope Shipments**; capturing ≥1 inventory photo is required to advance; lots (expiry) recorded. Tagline: *"The Heartbeat Of Business."*

### Couriers (`/couriers`)
Own-courier delivery jobs. Created from storefront orders; Operations assign, couriers self-assign and deliver; statuses incl. `POSTPONED` (required reason); "shipped" event names the courier + phone. Courier users get a mobile "My Deliveries" view. Tagline: *"The polite pilots."*

### Issues & Compensations (`/issues`)
Central module. Raise an issue against a **supplier / trip / courier** (explicit source picker) tied to a request/order/product; track lifecycle; issue groups; **compensations** (0-price orders). Visibility is domain-scoped per user (admins/Issues-role/Purchasing/Logistics/XOONX/pickup; **Sales is barred**). Tagline: *"Every Issue Has A Solution."*

### History (`/history`)
Read-only archive of **terminal (completed/cancelled) units** across ~10 sections (requests, request-groups, orders, order-groups, trips, shipments, issues, compensations, transfers, deliveries). Each section reuses the owning module's view permission **and is scope-filtered** (Sales/XOONX never get trips/transfers). Search + date range + paging; rows deep-link to existing detail pages. Tagline: *"If you forget, we don't."*

### Expenses (`/expenses`)
Operations cash expenses, money deliveries, monthly sales reconciliation (English categories). Tagline: *"Nothing escapes the ledger."*

### Settings (`/settings`, admin)
**All configuration in one place:** pricing params, expenses categories, supply-chain settings, scopes, **status flow** (split into Statuses / Mapping / Advancing + Remap), audit log, archive (restore/permanent-delete), announcements, **static pages CMS** (`ContentPage`, bilingual Markdown, PUBLIC pages render at `/p/[slug]` outside auth; INTERNAL redirect to login), branding/appearance, and the storefront **integration** retry UI. Granular guard `requireSettingsAccess()` + each section keeps its original permission. Tagline: *"Customize your experience."*

### Users & Privileges (`/users`, admin)
Accounts, teams, roles, permissions; assign roles/teams; per-user account page (self password change). Tagline: *"Everything is under control."*

---

## 6. Status engine & propagation (replicate carefully)
- Separate, **admin-configurable** status vocabularies for Orders, Products, Sales, Trips (codes + labels + colors + order).
- An order's status maps to a customer-facing **sales status**. A request's status **rolls up** from its orders: least-advanced internal status is representative; sales status computed from all orders (lost/damaged drop out like cancelled).
- **Convergence rule:** a trip only drives orders that have reached "Received Abroad"; orders still in the supplier phase keep their own status; terminal orders never advance.
- **Partial rollup** label: `"Partially <furthest> · n/m"` with a per-status breakdown.
- Issue-type → status automations are configurable. Editing a vocabulary can orphan codes → use the **Remap** tool post-deploy.

## 7. Cross-cutting systems
- **Search:** global header search + per-module search. Autocomplete from per-user recents + keyword index, typo-tolerant fuzzy fallback, **scope-filtered** (Sales autocomplete never surfaces XOONX names). Any-UID search.
- **Notifications:** categorized, priority-styled, per-user; bell menu + `/notifications`. `notify()` central helper; also fans out to **web push** (VAPID + `web-push`, no-op if env unset).
- **PWA:** dynamic web-app manifest (branding-aware icons via a sharp image route), a hand-rolled service worker (precache offline page; cache-first static; **network-first navigations**; network-only RSC/API so no stale/cross-user data; never cache the SW itself or `/api/brand/`), an install prompt that is **always actionable** (native button where supported, iOS Share hint, else a manual "open browser menu → Install app" fallback), and web push (enable-bell banner). Dismissal persists in `localStorage`.
- **Reverse-proxy safety:** auth route handlers must emit **relative `Location` redirects** (never build absolute URLs from `req.url`/Host behind a proxy, or it redirects to the internal host).
- **Storefront integration ("Veeey"):** HMAC machine-auth, idempotent inbound API (`/api/integration/v1/**`), an **outbox dispatcher** with exponential backoff (instrumentation hook) emitting outbound events (request status changes, milestones, shipment received, delivery status). EGV-only payloads — **no trip/traveller data ever leaves**. Feature-flagged off (404s) until env set. `Product.sku` is the canonical shared key.

## 8. UI / UX conventions
- Header: logo + app name + version, **module switcher** dropdown ("Modules" on mobile, "All modules" on desktop), global search (input on desktop, icon on mobile), user/teams chip, notifications bell, language/theme/logout menu. Static info pages live in the **footer** (not the header).
- Module pages use a left **ModuleNav** (collapsible) or top pill nav on mobile.
- Lists render as **sortable tables on desktop and stacked cards on mobile** (no sideways scroll). Sort controls via a `ListSort` component with `?param=` URL state, ascending/descending where relevant.
- Detail pages carry a **Connections** card (permission-gated links to related parents/children/siblings) — but Sales/XOONX never get trip/traveller links.
- Money/price visibility gated by role; supplier/trip/traveller names never shown to Sales.

## 9. Non-functional
- **Security:** RBAC at every page/action; scope `assertScope` on id-addressed writes; rate-limited login + push endpoints; password policy (8+ chars, letter+digit+symbol); no secrets in the repo (`.env` placeholder, real values in `.env.local`/server env); XSS-safe dependency-free Markdown renderer (escape-all + tag allowlist; links restricted to http/https/mailto/tel/relative).
- **Deployment:** Node 20, PM2 (`next start` behind a reverse proxy on :3000), SQLite file DB. Update flow: back up DB → replace code (wipe `src/public/tests/scripts` then extract, so removed files don't linger) → `npm ci` → `prisma generate` → `prisma migrate deploy` → (seed if RBAC/reference changed) → `next build` → `pm2 reload`. Post-deploy: remap orphaned status codes, grant any new roles.

## 10. Suggested build order (for the regenerating model)
1. Auth + session + users/roles/permissions/teams + seed + the Access/guard layer + Module registry + home dashboard.
2. Scope model + the EGV/XOONX golden-condition plumbing.
3. Product catalog + suppliers + customers + reference vocabularies (types, channels, priorities, statuses).
4. Sales requests + groups + rollup/partial-status engine.
5. Purchasing orders (Batch) + per-product picker + auto-group + order UIDs.
6. Logistics: travellers, offices, trips (lifecycle + rules), transfers, inventory, movements.
7. Operations: pickup + inventory photos + per-scope shipments + lots.
8. Issues & Compensations + the unified status engine config + Remap.
9. Couriers + delivery jobs.
10. Pricing calculator; Expenses; XOONX finance.
11. History; Settings (config relocation, CMS, audit, archive); search; notifications.
12. PWA + push; bilingual i18n + RTL; storefront integration (flagged off).

---

### Glossary (Yeldn-specific terms)
- **Item / Unit** = one physical unit of product (the serialized core entity; carries its own status/location/scope). Inventory = "Items at a location."
- **Order** = a placed supplier purchase (`Batch` in the original model; a set of Items in the per-unit model), not a customer order.
- **Request** = a customer's wish for a product (`OrderRequest`).
- **Trip** = one traveller's journey carrying inventory from a country to Egypt.
- **Office** = a holding hub abroad.
- **Scope** = business-line/data boundary (EGV / XOONX / PERSONAL).
- **Stuck** = inventory a traveller didn't bring / that arrived late, held for a later same-country trip.
- **Connections** = a unit's related parents/children/siblings, shown as a card.
