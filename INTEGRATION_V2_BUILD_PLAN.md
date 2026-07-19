# Build plan — Contract v2 (Products & Customers) + the VEEEY rename

> Companion to `INTEGRATION_V2_PRODUCTS_CUSTOMERS.md` (the approved contract).
> Three phases, each its own release. Phase 1–2 are YeldnIN work (this repo);
> the Veeey-side obligations (contract §7) are built in the eCommerce project
> by its own session. Phase 3 is an operator checklist, not code.

## Phase 1 — Rename scope `EGV` → `VEEEY` (standalone release)

Full internal rename, shipped and verified alone BEFORE any sync work, since it
touches the golden-rule enforcement surface.

1. Code: `SCOPES` constant, ~104 `"EGV"` literals across src (scope guards,
   helpers, tests), i18n keys (`scope.EGV` → `scope.VEEEY` + label text
   "Veeey" in en/ar, `sla.egv`, capability labels), seed data.
2. Schema/data: migration rewriting the scope VALUE in every scoped table
   (Product, Customer, Request, Item, Purchase, Patch, Transfer, Shipment,
   Issue, + any others `grep scope` finds) and updating `@default("EGV")`
   columns (e.g. Customer.scope).
3. **Wire-compat shim:** the LEGACY WooCommerce channel (live today) keeps
   sending/accepting `"EGV"` on the wire (one mapping in catalog/request wire
   code) so the old site never sees the rename. The new-Veeey contract (v2)
   uses `VEEEY` natively. Shim dies with the legacy channel at cutover.
4. Verify: full test suite (scope tests updated), typecheck, build; deploy via
   the schema-deploy order (generate → stop → migrate → build → start) with a
   pre-migration DB backup; smoke-test golden-rule surfaces as a Sales user
   (only-VEEEY visibility unchanged).

## Phase 2 — The two inbound endpoints + read-only enforcement (YeldnIN)

1. Migration (one): `Customer.veeeyCustomerId String? @unique` (column is
   missing today) + unique index on `Product.sku` — preceded by a duplicate-SKU
   audit/cleanup script (sku is currently non-unique).
2. `POST /api/integration/v1/products/upsert` per contract §1: SKU →
   legacyWpId-adoption → create matching; writes ONLY Veeey-owned fields;
   heavy-never-downgrades; scope guard; `archived` → soft-archive; photo URLs
   stored verbatim (ProductPhoto.assetId is a plain string — same pattern as
   request photos), render path becomes URL-aware + CSP img allowance for the
   Veeey domain.
3. `POST /api/integration/v1/customers/upsert` per contract §2: keyed on
   veeeyCustomerId, name-adoption fallback, stamps scope VEEEY + new seeded
   `VEEEY` contact channel; archived → soft-archive.
4. Both behind the existing HMAC + idempotency plumbing (`verifyInbound`),
   gated on the provider `enabled` flag; wire parsing as pure `*-wire.ts` with
   unit tests (existing pattern).
5. Read-only enforcement (server actions + UI, golden-rule style):
   Veeey-scope products — Veeey-owned fields locked, purchasing/logistics
   fields + heavy toggle stay editable; Veeey-scope customers — name/phone/
   channel locked, internal notes editable; product & customer CREATE becomes
   non-VEEEY-scope only.
6. Verify: unit tests for matching/ownership/heavy/scope rules; endpoint
   round-trip against seeded fixtures; typecheck/build; deploy (schema order).

## Phase 3 — Cutover (operators, when new Veeey is ready)

1. Veeey side (§7) confirmed built: SKU gen, `type` field populated, distinct
   variation names, upsert emitters + nightly sweep, guest filter.
2. Arm the prod inbound key (Settings → Integrations; currently null) and
   exchange it with Veeey.
3. New Veeey full catalog push (with legacyWpId) → 2,548 linked products adopt
   SKUs; verify counts + spot-checks; full registered-customer push; verify.
4. Retire the legacy `/catalog` channel + the EGV wire shim.

## Dependency map

- Phase 1 blocks nothing but should land first (contract v2 speaks `VEEEY`).
- Phase 2 can start immediately after Phase 1 merges.
- Phase 3 waits on the Veeey session finishing §7 — parallel to Phase 2.
