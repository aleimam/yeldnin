# Pass 1 — orientation

## Domain map

### Platform and access model

- `Module` is the registry for the 17 permission modules listed below. The checked-in mirror is `src/lib/modules.ts`; `prisma/seed.ts` reconciles those definitions into the table.
- `UserModulePermission` is the active four-level (`NONE` / `VIEW` / `OPERATE` / `MANAGE`) per-user module matrix. `AccessPolicy` stores JSON overrides for the minimum module level required by named capabilities.
- `User` is the identity root. Authentication hangs off `PasswordResetToken`; device push registration hangs off `PushSubscription`. A user has module permissions and may also have legacy role/team joins (`UserRole`, `TeamMember`).
- `Role`, `Permission`, `RolePermission`, `UserRole`, `TeamRole`, `Team`, and `TeamMember` retain the older RBAC/team graph in the schema. Current conventions say teams group users but do not grant module access.
- `PlatformSettings` owns branding, version/footer text, and document letterhead settings. `Asset` is the shared uploaded-file record; most domain records store an `assetId` string rather than a Prisma relation.
- `Counter` allocates human-readable monthly UIDs across domains.

### Operational chain

`Product` and `Customer` are the master-data roots for a customer `Request`. A request has one or more `RequestLine` rows, each pointing to a product and carrying count and price inputs. Once the request passes its scope-specific approval rule, the application creates one serialized `Item` per physical unit. The `Item` is the operational source of truth: it retains its product, request origin, scope, lifecycle status, prices, exception state, timers, and an append-only `ItemEvent` history.

Items move through containers by the polymorphic pair `Item.containerType` + `Item.containerId` rather than Prisma foreign keys:

`REQUEST` → `PURCHASE` → `PATCH` → `HUB` / `TRIP` → `TRANSFER` / `TRIP` → `SHIPMENT` → website stock.

- `Purchase` groups units being bought and optionally belongs to a `Supplier`; one purchase may create multiple `Patch` dispatches.
- `Patch` moves purchased units from a supplier to a destination. `Hub` is an overseas receiving location.
- `Traveler` owns `Trip` journeys. A trip can receive items, is reviewed through `TripMark`, and is split by Operations into scope-specific `Shipment` records.
- `Transfer` moves received units between hubs, trips, or traveler holding within a country.
- `Carrier` is a shipping company used by patches/transfers; `Courier` is a distinct last-mile person directory.
- `Issue` groups operational exceptions, has `IssueItem` snapshots and photos, and owns any `Compensation` rows. The exception service links item flags to issues.
- `ProductPhoto`, `RequestPhoto`, `TravelerPhoto`, `TripMarkPhoto`, `HubPhoto`, `PatchPhoto`, `TransferPhoto`, and `IssuePhoto` attach uploaded assets to their owners.
- `Country` is admin-managed reference data, while operational rows currently store country as strings. `FxRateCache` supports best-effort handling-fee conversion.

The hard scope boundary is denormalized onto `Product`, `Customer`, `Request`, `Item`, `Purchase`, `Patch`, `Shipment`, and `Issue` (nullable on issues). The active scope vocabulary is `VEEEY`, `XOONX`, and `PERSONAL`; customer records are only VEEEY or XOONX.

### Business and support domains

| Domain | Tables and relationships |
|---|---|
| Pricing | `PricingSettings` is the calculator configuration singleton. `PricingCalculation` belongs to a `User`, snapshots its inputs/config/supplier information, and owns `PricingPhoto` rows. `Supplier` is shared with Purchasing and the Product catalog. |
| XOONX finance | `XoonxExpenseCategory` owns `XoonxExpense`; expense request/trip references are scalar IDs. `XoonxFxRate` supplies monthly conversion, `XoonxMonthClose` freezes a monthly JSON snapshot, and `XoonxStaffShare` defines the staff-pool roster. |
| Operations expenses | `ExpenseCategory` owns `ExpenseTransaction`; a transaction belongs to its creator `User` and owns `ExpenseAttachment`. `MonthlyBankCollectionReport` owns lines that may point to `ExpenseAccount`; `MonthlySalesReport` and `MonthlyReconciliationNote` are month-unique summaries. |
| CS Quality | `CsEvalType` owns `CsQuestion`. `CsEvaluation` owns answer snapshots and photos and may have one `CsVeto`. `CsConfig` stores scoring JSON; `CsRepBonus` and `CsBonusTier` drive bonus calculation. |
| Human Resources | `Employee` is a strict one-to-one extension of `User`, self-relates through line management, and may belong to `Position`, `SalaryType`, and `EmployeeType`. It owns photos, events, salary structure lines, payslips, and engagement participation. Attendance uses `HrConfig`, `LeaveRequest`, `Absence`, `Holiday`/`HolidayBonus`, `DayType`, and `DutyDay`. `SalaryComponent` → `SalaryStructureLine` → `SalaryChange` models pay structure history; `Payslip` → `PayslipLine` freezes payroll. Engagement is `EngagementCategory` → `EngagementTemplate` → `EngagementCriterion`, with dated `EngagementEvent` rows joined to employees through `EngagementEligible` and `EngagementAchievement`. |
| Documents | `Document` may belong to `DocumentCategory`; it owns immutable `DocumentVersion` snapshots, `DocumentAck` acknowledgements, and team-keyed `DocumentPermission` grants. Its PDF/DOC payload is an asset ID or sanitized HTML. |
| Chat and inquiries | `ChatConversation` is a canonical user pair and owns `ChatMessage`; messages may reply to another message and own `ChatAttachment`. `Inquiry` points to initiator/recipient users, a polymorphic unit, and an optional `InquiryDisposition`; it owns `InquiryMessage`, which owns `InquiryAttachment`. |
| Notifications | `NotificationMessage` owns per-user `NotificationRecipient` read state. `PushSubscription` belongs to a user. `NotificationRule` is the admin routing matrix used by notification services. |
| Integration | `ApiIntegration` holds per-provider configuration and encrypted/hashed credentials. `OutboxEvent` is the outbound request-sync queue; `IntegrationNonce` is the inbound replay ledger; `IdempotencyRecord` stores replayable inbound responses. Product/customer inbound sync updates the shared master tables. |
| Settings/content/backup | `ContentPage` is the bilingual static-page CMS. `WorkflowConfig`, `SlaConfig`, `AccessPolicy`, `PricingSettings`, and `PlatformSettings` are singleton/config records. `BackupConfig` is the connection/global record, `BackupTier` holds independently scheduled tiers, and `BackupRun` is attempt history. |
| Audit/error logging | `AuditLog` records actor/module/action/entity metadata. `ErrorLog` records cross-app diagnostics and is pruned by the scheduled worker. |

### Cross-cutting code ownership

- Module registry/navigation: `src/lib/modules.ts`, `src/lib/module-sections.ts`, `src/lib/module-context.ts`, `prisma/seed.ts`.
- Access and capabilities: `src/lib/auth/access-logic.ts`, `src/lib/auth/access.ts`, `src/lib/auth/capabilities.ts`, `src/lib/auth/access-policy-service.ts`, plus `src/app/api/login/route.ts` and `src/app/api/logout/route.ts`.
- Item workflow, timers, scope helpers, UID allocation: `src/lib/items/*`, `src/lib/workflow/*`, `src/lib/sla/*`, `src/lib/uid.ts`.
- Shared assets: `src/lib/assets/assets-service.ts`, `src/app/api/upload/route.ts`, `src/app/api/asset/[id]/route.ts`.
- Universal UI systems: `src/app/chat/**` + `src/lib/chat/*`; `src/app/inquiries/**` + `src/lib/inquiry/*`; `src/app/notifications/**` + `src/lib/notify/*`; `src/app/search/**` + `src/lib/search/*`.
- External/scheduled surfaces: `src/app/api/integration/v1/**` + `src/lib/integration/*`; `src/app/api/cron/advance/route.ts`; `src/app/api/cron/backup/route.ts`.

## Full module list and owning files

The authoritative current list is the 17 entries in `src/lib/modules.ts` and `prisma/seed.ts`. Directory globs below include the pages/components beneath that route root; action and service owners are named explicitly where they sit outside it.

| Module key | Domain and table ownership | Owning files |
|---|---|---|
| `order_requests` | VEEEY Sales: shared `Request`, `RequestLine`, `RequestPhoto`, `Customer`, `Product`, `ProductPhoto`, and spawned `Item` rows. | `src/app/sales/page.tsx`; `src/app/requests/**`; `src/app/customers/**`; shared `src/app/products/**`; `src/lib/requests/request-logic.ts`; `src/lib/requests/request-service.ts`; `src/lib/customers/*`; `src/lib/products/*`; `src/lib/sla/*`; request emission in `src/lib/integration/request-sync.ts`. |
| `xoonx` | XOONX-scoped requests/customers/products plus `XoonxExpenseCategory`, `XoonxExpense`, `XoonxFxRate`, `XoonxMonthClose`, and `XoonxStaffShare`. | `src/app/xoonx/**`; shared `src/app/requests/**`, `src/app/customers/**`, `src/app/products/**`; `src/lib/xoonx/*`; shared `src/lib/requests/*`, `src/lib/customers/*`, `src/lib/products/*`; `src/app/settings/xoonx/**`. |
| `purchasing` | Buying pool and supplier orders: `Purchase`, shared `Supplier`, purchased `Item` state, and downstream `Patch` linkage. This permission module is folded into Logistics navigation. | `src/app/purchasing/**`; `src/lib/purchasing/purchasing-logic.ts`; `src/lib/purchasing/purchasing-service.ts`; `src/lib/suppliers/suppliers-service.ts`; supplier administration in `src/app/settings/logistics/**`. |
| `logistics` | Physical supply chain: `Traveler`, `Trip`, `Hub`, `Patch`, `Transfer`, `Carrier`, their photo tables, exception-state `Item` rows, and trip review data shared with Operations/Purchasing. | `src/app/logistics/page.tsx`; `src/app/travelers/**`; `src/app/trips/**`; `src/app/hubs/**`; `src/app/patches/**`; `src/app/transfers/**`; `src/app/carriers/**`; `src/app/exceptions/**`; `src/lib/travelers/*`; `src/lib/trips/*`; `src/lib/hubs/*`; `src/lib/patches/*`; `src/lib/transfers/*`; `src/lib/carriers/*`; `src/lib/exceptions/*`; shared `src/lib/items/*`, `src/lib/workflow/*`, `src/lib/review/*`. |
| `operations` | Trip pickup/review and per-scope shipment conversion: `Shipment`, `TripMark`, `TripMarkPhoto`, and the item/container transitions they drive. | `src/app/operations/page.tsx`; `src/app/operations/actions.ts`; `src/app/shipments/**`; shared trip UI under `src/app/trips/**`; `src/lib/operations/operations-logic.ts`; `src/lib/operations/operations-service.ts`; `src/lib/review/*`; shared `src/lib/items/*`. |
| `couriers` | Last-mile courier master data: `Courier`. | `src/app/couriers/**`; `src/app/couriers/actions.ts`; `src/lib/couriers/couriers-logic.ts`; `src/lib/couriers/couriers-service.ts`. |
| `issues` | `Issue`, `IssuePhoto`, `IssueItem`, and `Compensation`; also receives records from trip review and item exception flows. | `src/app/issues/**`; `src/app/issues/actions.ts`; `src/lib/issues/issues-logic.ts`; `src/lib/issues/issues-service.ts`; cross-writers in `src/lib/exceptions/exception-service.ts` and `src/lib/review/review-service.ts`. |
| `history` | Read-only item movement history over `Item` and `ItemEvent`, with scope-aware UID lookup. | `src/app/history/**`; `src/app/history/actions.ts`; `src/lib/history/history-logic.ts`; `src/lib/history/history-service.ts`; shared `src/lib/items/*`, `src/lib/workflow/*`, `src/lib/search/*`. |
| `pricing` | `PricingSettings`, `PricingCalculation`, and `PricingPhoto`; reads shared `Supplier` data. | `src/app/pricing/**`; `src/app/pricing/actions.ts`; `src/lib/pricing/pricing-logic.ts`; `src/lib/pricing/pricing-form-logic.ts`; `src/lib/pricing/pricing-service.ts`; `src/lib/pricing/pricing-config-service.ts`; variable editor in `src/app/settings/pricing/variables/**`. |
| `cs_quality` | `CsEvalType`, `CsQuestion`, `CsConfig`, `CsEvaluation`, `CsEvaluationAnswer`, `CsEvaluationPhoto`, `CsVeto`, `CsRepBonus`, and `CsBonusTier`. | `src/app/cs-quality/**`; `src/app/cs-quality/actions.ts`; all files under `src/lib/cs/*`. |
| `human_resources` | Employee profile/hierarchy, attendance, salary, payroll, analytics, and engagement tables described above. | `src/app/hr/**`; `src/app/hr/actions.ts`; all files under `src/lib/hr/*`. |
| `expenses` | `ExpenseCategory`, `ExpenseTransaction`, `ExpenseAttachment`, `ExpenseAccount`, `MonthlySalesReport`, `MonthlyBankCollectionReport`, `MonthlyBankCollectionLine`, and `MonthlyReconciliationNote`. | `src/app/expenses/**`; `src/app/expenses/actions.ts`; `src/app/expenses/admin/actions.ts`; `src/lib/expenses/*`; category/account editors in `src/app/settings/expenses/**`. |
| `settings` | Platform appearance/content, access-policy editor, workflow/SLA, notification rules, suppliers/countries, integration config, and backup config/history. Principal tables: `PlatformSettings`, `ContentPage`, `AccessPolicy`, `WorkflowConfig`, `SlaConfig`, `NotificationRule`, `Supplier`, `Country`, `ApiIntegration`, `BackupConfig`, `BackupTier`, `BackupRun`. | `src/app/settings/**` excluding pricing/expense subpages owned above; `src/lib/settings/*`; `src/lib/content/*`; `src/lib/countries/*`; `src/lib/integrations/*`; `src/lib/integration/config.ts`; `src/lib/backup/*`; `src/lib/workflow/workflow-config-service.ts`; `src/lib/sla/sla-config-service.ts`; `src/lib/notify/notify-config-service.ts`; `src/lib/suppliers/suppliers-service.ts`. |
| `user_access` | `User`, `PasswordResetToken`, `UserModulePermission`, `Team`, `TeamMember`, and the retained role/permission join tables. | `src/app/users/**`; `src/app/users/actions.ts`; `src/app/users/teams/actions.ts`; `src/lib/users/*`; `src/lib/teams/*`; `src/lib/auth/*`; shared registry files `src/lib/modules.ts`, `src/lib/module-sections.ts`, `prisma/seed.ts`. |
| `audit_log` | `AuditLog`. | `src/app/audit/**`; `src/lib/audit.ts`. |
| `error_log` | `ErrorLog`. | `src/app/error-log/**`; `src/app/error-log/actions.ts`; `src/app/api/error-log/route.ts`; `src/lib/errors/error-log-service.ts`. |
| `documents` | `Document`, `DocumentVersion`, `DocumentAck`, `DocumentCategory`, and `DocumentPermission`; uses `Asset` IDs and `PlatformSettings` letterhead fields. | `src/app/documents/**`; `src/app/documents/actions.ts`; `src/app/api/documents/**`; all files under `src/lib/documents/*`; shared `src/lib/assets/assets-service.ts`. |

## Open orientation questions for later passes

These are documentation/model questions, not findings.

- `APP_BLUEPRINT.md` describes an older generation of the app: EGV naming, `/pricer`, `better-sqlite3`, team/role inheritance, an in-progress Item migration, 12 modules, and several older UID/status names. Current code instead uses VEEEY, `/pricing`, `prisma-adapter-node-sqlite`, per-user module levels, a fully serialized Item core, and 17 modules. Later passes should use current schema/code and determine which blueprint statements remain normative.
- The schema retains `Role`, `Permission`, `RolePermission`, `UserRole`, and `TeamRole`, while the current conventions say module permissions are purely per-user. It is not yet clear which legacy RBAC paths remain live outside the module matrix.
- `Item.containerType` and inquiry `unitKind` accept `ORDER`, but the current schema has no `Order` model. The intended current target or legacy meaning of that value needs tracing.
- Several important links are scalar IDs or polymorphic references without Prisma relations, including item containers/request origin, issue items, patch/transfer carriers, XOONX expense request/trip links, some HR/user/team references, document acknowledgers, notification recipients, and asset IDs. Later flow passes should establish where existence, scope, and deletion integrity are enforced.
- The blueprint describes a `DeliveryJob` workflow, customer-delivery statuses, assignment, and cash collection. The current schema and route map expose only `Courier` master data; it is not yet clear whether delivery jobs were removed, deferred, or represented elsewhere.
- `Country` is an admin-managed table, but some pure logic still carries fixed `USA` / `UK` / `EU` vocabularies and operational records store country strings. The boundary between import regions and managed operational countries needs confirmation in the relevant flow pass.
- `BackupConfig` retains the older single-schedule and GFS fields alongside the newer independent `BackupTier` rows. Pass 9 should establish which fields are compatibility data and which still participate in execution.
- The trip lifecycle is split across `trip-logic`, Operations conversion, item status, and free-form string columns; it does not read as a single schema-level state machine. The request/order/fulfilment and Operations passes should reconstruct the complete live transition graph.
- The handoff's headline counts (123 routes, 398 tests) lag the current baseline (the build generated 124 routes/pages and the suite contains 429 tests). This appears to be documentation drift, but later coverage reporting should use observed counts.

## Pass 2 — golden rule

### Section 1 — Defects, most severe first

### [P0] The request integration can export, create, and overwrite non-VEEEY records
- **Where:** `src/lib/integration/request-sync.ts:25`, `src/lib/integration/request-sync.ts:86`, `src/lib/integration/request-sync.ts:91`, `src/lib/integration/request-sync.ts:106`, `src/lib/integration/request-sync.ts:116`, `src/lib/integration/request-sync.ts:121`, `src/lib/integration/request-sync.ts:125`; `src/lib/integration/request-wire.ts:102`, `src/lib/integration/request-wire.ts:135`; callers in `src/lib/requests/request-service.ts:73`, `src/lib/requests/request-service.ts:173`, `src/lib/requests/request-service.ts:185`, `src/lib/requests/request-service.ts:265`.
- **What happens:** outbound request sync loads any request ID and queues its customer, lines, prices, photos, and scope without requiring `VEEEY`. Inbound parsing accepts any scope string; the handler matches products without a scope filter and upserts by UID without checking the stored request scope, replacing the existing lines and photos.
- **Trigger:** with the Veeey integration enabled, as a XOONX user create or edit a XOONX request -> `emitRequestSync` records a `request.upsert` outbox payload containing that XOONX order. In the opposite direction, send an otherwise-valid signed Veeey request payload whose `scope` is `XOONX` and whose UID belongs to a XOONX request -> the handler deletes and replaces that XOONX request's lines/photos and accepts any globally matching product SKU.
- **Impact:** the integration crosses the hard business-line boundary in both directions, disclosing XOONX data to Veeey and giving the Veeey channel a write path into XOONX or PERSONAL records.
- **Fix:** make outbound emission return unless the loaded request is `VEEEY`; make inbound parsing/handling reject every normalized scope except `VEEEY`; load `{ id, scope }` for an existing UID and reject non-VEEEY rows before the transaction; restrict SKU matching to VEEEY products.
- **Confidence:** high.

### [P0] Product edits authorize the submitted scope instead of the stored product scope
- **Where:** `src/app/products/actions.ts:60`, `src/app/products/actions.ts:64`, `src/app/products/actions.ts:67`, `src/app/products/actions.ts:78`, `src/app/products/actions.ts:89`, `src/app/products/actions.ts:91`.
- **What happens:** `saveProductAction` checks whether the caller may operate `p.scope` before loading the product. For a non-VEEEY stored product it then writes that client-supplied scope and all submitted fields to the arbitrary ID.
- **Trigger:** as a Sales user, invoke `saveProductAction` with the ID of a XOONX product, `scope: "VEEEY"`, and otherwise valid product fields -> the Sales scope check passes, and the XOONX product is overwritten and re-scoped to VEEEY.
- **Impact:** a Sales user can mutate an off-scope catalog record, expose it to Sales, and leave its existing XOONX requests/items inconsistent with the product's new scope.
- **Fix:** load first, authorize `existing.scope`, reject any submitted scope different from the stored scope for non-admins, and pass the stored scope to `updateProduct`.
- **Confidence:** high.

### [P0] Request create/edit accepts a customer from another scope
- **Where:** `src/app/requests/actions.ts:38`, `src/app/requests/actions.ts:53`, `src/app/requests/actions.ts:72`, `src/app/requests/actions.ts:89`; `src/lib/requests/request-service.ts:27`, `src/lib/requests/request-service.ts:39`, `src/lib/requests/request-service.ts:48`, `src/lib/requests/request-service.ts:201`, `src/lib/requests/request-service.ts:214`, `src/lib/requests/request-service.ts:231`; rendered at `src/app/requests/[id]/page.tsx:25` and `src/app/requests/[id]/page.tsx:52`.
- **What happens:** the actions validate the request scope and line-product scopes but never load the submitted `customerId`. The services write that ID directly, so the database foreign key enforces existence but not matching scope.
- **Trigger:** as a Sales user, create a `VEEEY` special-order request with valid VEEEY lines and the ID of a XOONX customer -> the request is created and `/requests/<new id>` renders the XOONX customer's name. The same substitution works when editing an in-scope request.
- **Impact:** off-scope customer identity is disclosed and persisted on the wrong business line; downstream request views, search, sync, and notifications can propagate the association.
- **Fix:** load the customer in the action/service and require `customer.scope === request.scope`, treating an off-scope ID exactly like a missing/invalid customer; enforce the check inside the write transaction as defense in depth.
- **Confidence:** high.

### [P0] XOONX issue creation writes outside the caller's visible scope
- **Where:** `src/app/issues/actions.ts:23`, `src/app/issues/actions.ts:27`; `src/app/issues/IssueForm.tsx:16`, `src/app/issues/IssueForm.tsx:24`; `src/lib/issues/issues-logic.ts:13`; `src/lib/issues/issues-service.ts:8`, `src/lib/issues/issues-service.ts:20`.
- **What happens:** the create action checks only the `issues.operate` capability. It neither derives nor validates the new issue's scope against `issueVisibility`; the normal form omits scope entirely, while a crafted call may submit any string.
- **Trigger:** as a XOONX user with Issues OPERATE, open `/issues/new` and submit the normal form -> an unscoped back-office issue is created and the redirect to `/issues/<new id>` ends in 404 because XOONX may see only XOONX issues. Or submit `scope: "VEEEY"` directly -> a VEEEY issue is created.
- **Impact:** a scoped operator can create and notify on records outside their business line, including records they cannot subsequently view.
- **Fix:** derive `XOONX` for XOONX-scoped creators (or offer only allowed scope choices), validate the final scope with `issueVisible(issueVisibility(access), scope)`, reject unscoped/off-scope creation, and repeat the invariant in `createIssue`.
- **Confidence:** high.

### [P0] The generic asset endpoint serves issue and logistics photos to any signed-in user
- **Where:** `src/app/api/asset/[id]/route.ts:25`, `src/app/api/asset/[id]/route.ts:37`, `src/app/api/asset/[id]/route.ts:77`, `src/app/api/asset/[id]/route.ts:87`; omitted owners include `IssuePhoto`, `TravelerPhoto`, `TripMarkPhoto`, `HubPhoto`, `PatchPhoto`, and `TransferPhoto` in `prisma/schema.prisma:547`, `prisma/schema.prisma:607`, `prisma/schema.prisma:643`, `prisma/schema.prisma:745`, `prisma/schema.prisma:942`, `prisma/schema.prisma:989`.
- **What happens:** object ACLs exist for seven attachment types, but every other asset falls through to `readAsset` after authentication. The route does not check issue scope or the hard Trip/Traveler bar for their photo tables.
- **Trigger:** as a XOONX user, request `/api/asset/<asset id from a VEEEY IssuePhoto>` -> the image is returned with 200. As a Sales user, request a known/reused `TravelerPhoto` or `TripMarkPhoto` asset ID -> the trip/traveler image is returned with 200.
- **Impact:** off-scope issue evidence and categorically forbidden trip/traveler data can be fetched by direct asset ID.
- **Fix:** resolve every owning relation before reading the asset and apply the owner's page-level module/scope/hard-bar policy; default-deny non-branding assets with no recognized authorized owner, using the same not-found response for missing and forbidden IDs.
- **Confidence:** high.

### [P0] Global search ignores scope for Items and Issues
- **Where:** `src/lib/search/search-service.ts:221`, `src/lib/search/search-service.ts:226`, `src/lib/search/search-service.ts:237`, `src/lib/search/search-service.ts:246`; contrast `src/lib/issues/issues-service.ts:62`, `src/lib/history/history-service.ts:47`, and `src/app/history/items/[id]/page.tsx:19`.
- **What happens:** the issue search is gated only by the Issues module and queries every issue; the item search is gated only by History and queries every item. Neither query applies `issueVisibility`/`issueVisible` or `historyScopes`, although the destination list/detail surfaces do.
- **Trigger:** as a XOONX user with Issues VIEW, search for the exact title or UID of a VEEEY issue -> its UID, title, status, and link appear even though the link 404s. As a Sales user with History VIEW, search for a XOONX item UID or its product name -> the XOONX item UID and product name appear even though `/history/items/<id>` 404s.
- **Impact:** search discloses the existence and identifying metadata of off-scope issues and serialized inventory units.
- **Fix:** build the issue predicate from `issueVisibility(access)` and omit the issue search group when visibility is null; add `scope: { in: historyScopes(access) }` to the item query and omit it when the scope set is empty.
- **Confidence:** high.

### [P0] Inquiry ITEM actions authorize only the History module, not the item's scope
- **Where:** `src/app/inquiries/actions.ts:19`, `src/app/inquiries/actions.ts:27`; `src/lib/inquiry/inquiry-logic.ts:74`, `src/lib/inquiry/inquiry-logic.ts:76`, `src/lib/inquiry/inquiry-logic.ts:97`; `src/lib/inquiry/inquiry-service.ts:62`, `src/lib/inquiry/inquiry-service.ts:78`, `src/lib/inquiry/inquiry-service.ts:84`.
- **What happens:** only REQUEST and PURCHASE are classified as scope-bearing inquiry units. For ITEM, `canViewUnit` checks `history` VIEW but never loads the item's stored scope; actor enumeration then reads the arbitrary item's creator and event actors.
- **Trigger:** as a Sales user with History VIEW, call `listUnitActorsAction("ITEM", <a XOONX item id>)` for an item with recorded events -> names/avatars of users who handled the XOONX item are returned. Use one returned user in `createInquiryAction` -> an inquiry linked to that XOONX item is created.
- **Impact:** a direct-ID action reveals off-scope item existence and personnel, then permits a persistent cross-scope inquiry and notifications around that item.
- **Fix:** classify ITEM as scope-bearing, load its scope in `canViewInquiryUnit`, require it in `historyScopes(access)`, and have actor lookup operate only after that stored-record authorization succeeds.
- **Confidence:** high.

### [P0] Issue notifications fan VEEEY details out to XOONX issue operators
- **Where:** `src/lib/issues/issues-service.ts:27`, `src/lib/issues/issues-service.ts:46`; `src/lib/exceptions/exception-service.ts:39`, `src/lib/exceptions/exception-service.ts:44`, `src/lib/exceptions/exception-service.ts:52`; `src/lib/notify/notify-service.ts:137`, `src/lib/notify/notify-service.ts:146`; `src/lib/notify/notify-logic.ts:16`, `src/lib/notify/notify-logic.ts:100`, `src/lib/notify/notify-logic.ts:116`.
- **What happens:** every issue-opened call resolves recipients without the issue scope. The default rule targets all `issues` operators, and `issues` is treated as cross-scope by `modulesForScope`; recipient resolution never applies the special rule that a user who also has XOONX access may see only XOONX issues. The push body contains the issue UID and title.
- **Trigger:** with the default/enabled `issue.opened` rule, give a XOONX user XOONX access plus Issues OPERATE, then have Logistics flag a VEEEY item as lost/damaged -> the XOONX user's push notification contains the VEEEY issue UID and a title derived from the VEEEY product.
- **Impact:** notifications disclose VEEEY exception existence and product-identifying text to the other business line even though the issue list/detail correctly hides the record.
- **Fix:** pass the issue's scope at every call site and resolve recipients by each user's effective `issueVisibility`, not module name alone; exclude recipients for whom `issueVisible` is false.
- **Confidence:** medium — the default rule proves the code path, but a production DB override could disable or retarget that event.

### [P0] Request-line validation reveals off-scope product names by ID
- **Where:** `src/app/requests/actions.ts:24`, `src/app/requests/actions.ts:51`, `src/app/requests/actions.ts:86`; `src/lib/requests/request-service.ts:453`; `src/lib/requests/request-logic.ts:80`.
- **What happens:** validation loads product IDs globally, including their names and scopes. When a product is off-scope, the returned error embeds its name; a nonexistent ID follows a different error path.
- **Trigger:** as a Sales user, submit a VEEEY request containing the ID of a XOONX product -> the action returns `"<XOONX product name>" isn't a VEEEY product.` Submit a nonexistent ID instead -> it returns `One of the products no longer exists.`
- **Impact:** a Sales user can enumerate off-scope product IDs and recover product names/existence through validation errors.
- **Fix:** query line references within the authorized request scope and report the same generic invalid-product error for missing and off-scope IDs; do not include an unviewable product's name.
- **Confidence:** high.

### [P0] Request approval actions expose off-scope request existence
- **Where:** `src/app/requests/actions.ts:113`, `src/app/requests/actions.ts:127`; `src/lib/requests/request-service.ts:162`, `src/lib/requests/request-service.ts:178`.
- **What happens:** approve/reject checks the Sales approval capability but never checks the loaded request's scope. The service returns success for any existing non-PENDING request and throws `Request not found.` for a missing ID; an off-scope PENDING row would also be mutated.
- **Trigger:** as a Sales manager, call `approveRequestAction(<an existing XOONX request id>)` -> it returns `{ ok: true }`; call it with a nonexistent ID -> it returns `{ ok: false, error: "Request not found." }`.
- **Impact:** Sales can confirm arbitrary XOONX request IDs; any off-scope row that reaches PENDING can also be approved/rejected and have items spawned.
- **Fix:** load the record in the action/service with `scope: "VEEEY"` (or authorize the stored scope through `requestScopes`) and make missing/off-scope behavior indistinguishable before status handling or sync emission.
- **Confidence:** high.

### [P0] Customer direct-ID paths distinguish off-scope records from missing records
- **Where:** `src/app/customers/[id]/page.tsx:13`, `src/app/customers/[id]/page.tsx:14`, `src/app/customers/[id]/page.tsx:15`; `src/app/customers/actions.ts:31`, `src/app/customers/actions.ts:33`, `src/app/customers/actions.ts:35`.
- **What happens:** the customer page returns 404 for a missing ID but redirects to `/customers` for an existing off-scope ID. The save action similarly returns `Not found.` for missing and `You can't manage customers in that scope.` for off-scope.
- **Trigger:** as a Sales user, open `/customers/<a XOONX customer id>` -> the browser redirects to `/customers`; open `/customers/<a nonexistent id>` -> it renders 404. The same distinction is observable by calling `saveCustomerAction` with those IDs.
- **Impact:** Sales can enumerate which customer IDs exist in XOONX despite being barred from learning that those records exist.
- **Fix:** fold scope into the lookup or return `notFound()` for both missing and forbidden records; make action responses identical for missing and off-scope IDs.
- **Confidence:** high.

### Section 2 — UI/UX enhancements, by impact / effort

No UI/UX enhancements were recorded. This pass was restricted to golden-rule defects.

### Section 3 — Coverage log

- Read `CODEX_AUDIT_BRIEF.md` end to end and limited this pass to section 3.1 plus section 4 items 1-2.
- Enumerated every exported `src/app/**/actions.ts` action, then traced every action accepting a scope-bearing payload or an ID that can reach Product, Customer, Request, Item, Purchase/Patch/Shipment, Issue, Trip/Traveler, or their assets. Non-scope correctness of those actions is reserved for later passes.
- Checked scope helpers and their callers for products, customers, requests, history, issues, search, inquiry unit access, notifications, SLA summaries, purchasing/logistics/operations lists, and XOONX reports.
- Checked list queries, counts/aggregates, dynamic detail/edit routes, client props, global search, notifications, audit-log access, revalidation/caching call sites, the generic upload/asset routes, document PDF ACLs, and all integration API routes/payload builders for scope-bearing data. No separate scope-bearing print/export endpoint was found.
- Confirmed that product/request/history/issue detail pages, scoped list counts, XOONX finance reports, trip/traveler page hard bars, and the product/customer Veeey upsert services apply their expected stored-record or scope filters; they produced no additional findings.
- Deliberately did not report the legacy `EGV` request-wire shim, which section 7 marks as intentional.
- Could not execute the actor-specific triggers: there are no supplied Sales/XOONX sessions or audit fixtures, and this audit is read-only. Integration enablement and the production notification-rule override were not inspected. The findings above are source-traced; the notification finding is marked medium for that runtime-config uncertainty.
- Did not assess transactions, UID races, business workflow correctness, backup/cron behavior, error handling, performance, dates, secrets, or UI/UX quality; those belong to later passes and were not started.
