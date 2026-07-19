# Contract v2 — Cutover runbook (Phase 3)

> The switch-on procedure for the new-Veeey product/customer sync. Both sides
> are BUILT, DEPLOYED, and verified wire-compatible. This is an **operations**
> procedure — a controlled, reversible switch, not a code change. Do the steps
> in order; each has a verify gate. Nothing here fires until the flags are armed.
>
> Owner/operator actions are marked **[OWNER]**; YeldnIN-verification steps
> **[YELDNIN]** (run by this session or from `ssh veeey`).
>
> ## ✅ STATUS 2026-07-19 — CUTOVER COMPLETE
>
> Steps 1–4 were executed by the Veeey side (it armed `integration.v2.enabled`
> and swept everything). Verified on prod: **2,555 / 2,556 VEEEY products
> SKU-keyed, 16,235 customers with `veeeyCustomerId`**, type pass done
> (2,503 SUPPLEMENT / 37 DEVICE / 16 INJECTION), supply-chain fields intact.
> Step 6's catalog half is now done too. **Nothing remains** except the EGV
> wire shim, intentionally held back for the Phase D re-baseline (see step 6).
> The old egyptvitamins.net WordPress was checked: it has **no YeldnIN
> webhook** (only Shippo/OPay), so there was nothing to switch off there.

## Preconditions (all true today)

- YeldnIN v2 endpoints live: `POST /api/integration/v1/{products,customers}/upsert`
  (deployed `166f44a`). YeldnIN integration is ENABLED on prod.
- Veeey emitters + nightly sweep built (`product-customer-sync.ts`), gated behind
  a NEW setting **`integration.v2.enabled`** that ships **OFF**.
- Transport + payloads verified compatible (raw body, path, HMAC, headers,
  `Idempotency-Key`); the legacy wpId-keyed `/catalog` channel keeps running
  UNCHANGED alongside until step 6.
- **Proven on dev (2026-07-19):** sku-match update, `legacyWpId`→SKU adoption,
  brand-new create, heavy-never-downgrade, and — critically — **every
  YeldnIN-owned supply-chain field (purchase price, supplier, weight, origin,
  size, grade) is PRESERVED** through a resync (partial upsert). Photos hotlink.

## Step 0 — baseline snapshot [YELDNIN]

Record the "before" counts so the sweep can be verified:
```sql
SELECT COUNT(*) FROM Product WHERE scope='VEEEY';                     -- total Veeey products
SELECT COUNT(*) FROM Product WHERE scope='VEEEY' AND sku IS NOT NULL; -- already SKU-keyed
SELECT COUNT(*) FROM Product WHERE scope='VEEEY' AND veeeyWpId IS NOT NULL; -- linked by wpId
SELECT COUNT(*) FROM Customer WHERE scope='VEEEY';
SELECT COUNT(*) FROM Customer WHERE veeeyCustomerId IS NOT NULL;      -- 0 expected pre-cutover
```
Also confirm a fresh DB backup exists on the box (`prisma/dev.db.bak.*`).

## Step 1 — Veeey prerequisites [OWNER, Veeey session]

- Populate the base **`type`/`kind`** for the existing catalog (the type-seed
  CSV is the bulk default; DEVICE/INJECTION items need an editorial pass — most
  seeded as SUPPLEMENT).
- Confirm SKU assignment is wired (`ensureIntegrationSku` mints on first emit;
  products with a `legacyWpId` get that number as SKU → matches YeldnIN's
  existing `sku`/`veeeyWpId`).

## Step 2 — arm the v2 channel [OWNER]

Flip Veeey's **`integration.v2.enabled`** setting ON. (YeldnIN needs nothing —
its endpoints are already live and enabled.) Emitters now fire on
create/update; the sweep will push everything.

## Step 3 — CONTROLLED TEST PUSH — go/no-go gate [OWNER → YELDNIN]

Do **not** sweep the whole catalog blind. First have Veeey push a **handful**
(≈5) of products spanning the cases — one plain, one that was already
SKU-matched, one variation, one with a `legacyWpId` but no prior YeldnIN sku,
and one customer.

**[YELDNIN] verify the test batch:**
```sql
-- the pushed products exist, SKU-keyed, still VEEEY, uid minted
SELECT id, uid, sku, veeeyWpId, name, type, scope FROM Product
  WHERE sku IN (<the 5 skus>);
-- CRITICAL: their supply-chain data is intact (spot a product Purchasing had filled)
SELECT sku, purchasePrice, defaultSupplierId, weightG, originRegion FROM Product
  WHERE sku = '<a known-filled sku>';
-- the customer
SELECT uid, veeeyCustomerId, name, contactNumber, scope, contactChannel
  FROM Customer WHERE veeeyCustomerId = '<VC id>';
```
Also check **Settings → Integrations** (outbox: no DEAD events) and
`pm2 logs yeldnin` for errors. **STOP if** any supply-chain field changed, a
non-VEEEY product was touched, or events are failing.

## Step 4 — full sweep [OWNER → YELDNIN]

Trigger Veeey's nightly sweep (or run it on demand). It re-pushes the full
catalog (with `legacyWpId`) then all registered customers — idempotent upserts.

**[YELDNIN] verify coverage vs the step-0 baseline:**
```sql
SELECT COUNT(*) FROM Product WHERE scope='VEEEY' AND sku IS NOT NULL; -- should ≈ Veeey's active catalog
SELECT COUNT(*) FROM Product WHERE scope='VEEEY' AND sku IS NULL;     -- residual unlinked — investigate each
SELECT COUNT(*) FROM Customer WHERE veeeyCustomerId IS NOT NULL;      -- should ≈ Veeey registered customers
```
Sanity: total VEEEY product count shouldn't have jumped unexpectedly (adoption
updates existing rows; only genuinely-new Veeey products create rows). Spot-check
a few products' supply-chain fields again.

## Step 5 — soak [OWNER]

Let both run in parallel for a short window (a day). Confirm ongoing
create/update on Veeey reflects in YeldnIN and no DEAD outbox events accumulate.

## Step 6 — retire the legacy channel [YELDNIN, code]

**Catalog half — DONE.** Removed the legacy `/api/integration/v1/catalog` route
+ `catalog-sync.ts` / `catalog-wire.ts` (wpId-keyed) and its test. Verified
safe first: `IdempotencyRecord` showed **no successful `v1.catalog` call after
2026-07-18 15:25** (the one-time backfill burst), and Veeey's `emitCatalogSync`
already no-ops while v2 is armed. Note the old handler was actively *unsafe* if
it ever fired again — it wrote `name`/`type`/`active` with **no scope guard, no
heavy-never-downgrade, and no partial-upsert**, so a stray push could downgrade
a HEAVY_SUPPLEMENT or match a non-VEEEY product by sku. `Product.veeeyWpId` is
KEPT (historical adoption link, still carried by 2,548 rows).

**EGV wire shim — DELIBERATELY NOT REMOVED.** The original plan assumed "the new
Veeey speaks `VEEEY` natively". That is **false for the request channel**:
Veeey's `src/lib/integration/request-sync.ts` still defaults `scope` to
`'EGV'`. Dropping `toWireScope`/`fromWireScope` unilaterally would break request
sync the moment Phase D is re-enabled. The shim retires as part of the Phase D
contract re-baseline, flipped on BOTH sides in one window.

- Full verify gate (typecheck · vitest · i18n parity · build) + deploy.

## Rollback

⚠️ **The rollback shape CHANGED at step 6.** Previously, flipping Veeey's
`integration.v2.enabled` **OFF** made the legacy `/catalog` channel resume and
carry the sync. **That path no longer exists** — YeldnIN does not serve
`/catalog` anymore.

- **Today:** disarming `integration.v2.enabled` simply **stops** product/customer
  sync (it does not fall back to anything). That is safe: no YeldnIN data is
  lost, upserts are non-destructive, and supply-chain fields were never written.
- **To truly restore the legacy channel:** revert the step-6 commit and redeploy
  (~5 min — the route and both modules are recoverable from git history).
- Restore the DB backup only if a bad push is suspected (shouldn't be possible
  given the partial-upsert + scope guard).
