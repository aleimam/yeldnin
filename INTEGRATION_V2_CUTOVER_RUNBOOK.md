# Contract v2 — Cutover runbook (Phase 3)

> The switch-on procedure for the new-Veeey product/customer sync. Both sides
> are BUILT, DEPLOYED, and verified wire-compatible. This is an **operations**
> procedure — a controlled, reversible switch, not a code change. Do the steps
> in order; each has a verify gate. Nothing here fires until the flags are armed.
>
> Owner/operator actions are marked **[OWNER]**; YeldnIN-verification steps
> **[YELDNIN]** (run by this session or from `ssh veeey`).

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

Only after step 4/5 are clean. This IS a YeldnIN code change (a small PR):
- Remove the legacy `/api/integration/v1/catalog` route + `catalog-sync.ts` /
  `catalog-wire.ts` (wpId-keyed) and the Veeey-side `catalog.upsert` emitter.
- Remove the **EGV wire shim** in `request-wire.ts` (`toWireScope`/`fromWireScope`)
  — the new Veeey speaks `VEEEY` natively, so the request wire can carry `VEEEY`
  directly. Coordinate this flip with the Veeey side in the same window.
- Full verify gate (typecheck · vitest · i18n parity · build) + deploy.

## Rollback

At any step before 6: flip Veeey's `integration.v2.enabled` **OFF**. The v2
endpoints stop receiving pushes; the legacy `/catalog` channel (untouched)
keeps the old sync working; no YeldnIN data is lost (upserts are non-destructive
and supply-chain fields were never written). Restore the DB backup only if a bad
push is suspected (shouldn't be possible given the partial-upsert + scope guard).
