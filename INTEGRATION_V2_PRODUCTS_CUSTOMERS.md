# Veeey ↔ YeldnIN Contract v2 — Products & Customers slice (DRAFT)

> Re-baseline of `INTEGRATION_CONTRACT.md` (v1, in the Veeey/eCommerce repo) for the
> **product catalog** and **customer** channels only. Supersedes v1 §4.2
> (`/products/upsert`) and adds `/customers/upsert`. Everything else in v1 —
> auth (§1 HMAC), idempotency (§2), errors (§3), requests, revenue, deliveries,
> `shipment.received` — is untouched here. Status: **DRAFT — pending owner approval.**
>
> Target: the **new Next.js Veeey** (eCommerce repo). The legacy WooCommerce
> `/catalog` sync (wpId-keyed) keeps running until the new Veeey launches, then
> retires (§6 cutover).

## 0. Ownership (the one-writer rule)

Every field has exactly one master; the other side never writes it.

| Owner | Fields |
|---|---|
| **Veeey** (masters, syncs down, read-only in YeldnIN) | product: `sku`, `name`, base `type`, photos · customer: identity (`veeeyCustomerId`), `name`, `phone` |
| **Veeey** (internal, never synced) | category, selling price, published/active state, orders, stock |
| **YeldnIN** (Purchasing / Logistics / Ops edit; sync never touches) | purchase price · supplier (single; the supplier list + SLA class/regions live only in YeldnIN) · origin · purchase URL · purchase note · weight · **size · grade** · **heavy flag** · YeldnIN's own `active` · `uid` · all operational data (items, requests, pricing, journey) |
| **YeldnIN** (entirely local) | all **XOONX** and PERSONAL products & customers — the sync may never touch a non-Veeey-scope row |

Scope note: after the standalone rename release, YeldnIN's internal scope value
`EGV` becomes **`VEEEY`**. This contract uses `VEEEY`; read v1's "EGV" as the same
scope.

## 1. `POST /api/integration/v1/products/upsert` (Veeey → YeldnIN)

Auth per v1 §1; `Idempotency-Key` required per v1 §2. One call per product
(variations are separate products).

```jsonc
{
  "sku": "120057-1",           // REQUIRED — canonical shared key. Veeey auto-generates:
                                //   base product → its numeric product id ("120057")
                                //   variation N  → "ID-N" ("120057-1", "120057-2", …)
  "legacyWpId": 120057,         // optional — old WordPress id; used ONCE for adoption (§6)
  "name": "Vitamin D3 5000IU — 120 caps", // REQUIRED — must be unique in YeldnIN;
                                // variations must carry distinct names (append attributes)
  "type": "SUPPLEMENT",         // REQUIRED — base codes only: SUPPLEMENT | DEVICE | INJECTION
  "size": "120 caps",           // optional — Veeey does NOT model size/grade today (they
  "grade": "A",                 //   stay YeldnIN-owned/editable). Kept optional so that
                                //   IF Veeey ever adds them they flow through — otherwise
                                //   omit; the partial-upsert never nulls them.
  "photoUrls": ["https://veeey.com/img/…"],  // optional, absolute https, max 6, replace-all
  "archived": false             // optional — true ONLY on hard-delete (§4)
}
```

> **Reconciliation note (v2 alignment, 2026-07-19):** the Veeey storefront's
> product model has no `size`/`grade`, so it does **not** send them. They are
> therefore **YeldnIN-owned and editable** (moved in §0). YeldnIN's handler is a
> **partial upsert**: it writes only the fields present in the payload, so an
> omitted `size`/`grade`/`photoUrls` PRESERVES the local value rather than
> nulling it.

**Matching order (upsert):**
1. by `sku` (canonical);
2. else by `legacyWpId` → an existing YeldnIN product linked via `veeeyWpId`
   **adopts** this `sku` (the one-time wpId→SKU migration, §6);
3. else **create**, scope `VEEEY`, with a YeldnIN-minted `uid` (PRD…).

**Write rules:**
- **Partial upsert** — writes only the Veeey-owned fields actually present:
  `sku`, `name`, `type` always; `size`/`grade`/photos only when sent (omitted →
  preserved). Never the YeldnIN-owned fields in §0 — a resync can never clobber
  purchasing data.
- **Heavy never downgrades:** if YeldnIN has `HEAVY_SUPPLEMENT` and the payload
  says `SUPPLEMENT`, the local type stays `HEAVY_SUPPLEMENT`. (Veeey knows
  nothing about heavy; it's a Logistics/Purchasing refinement.)
- **Scope guard:** if the matched product is not scope `VEEEY` →
  `422 product_scope_mismatch`, no write.
- Photos are stored as URLs and rendered by hotlink (no copy import). Replace-all
  per push.

**Response:** `200 {"ok":true,"productId":n,"sku":"…","created":bool,"adoptedFromWpId":bool}`
Errors (v1 envelope): `validation_failed`, `name_conflict`, `sku_conflict`,
`product_scope_mismatch`, `unknown_type`.

## 2. `POST /api/integration/v1/customers/upsert` (Veeey → YeldnIN) — NEW

Registered customers only — **never guests** (Veeey's responsibility to filter;
any special/pre-order must be claimed by a registered customer anyway).

```jsonc
{
  "veeeyCustomerId": "VC-123",  // REQUIRED — stable Veeey id, the correlation key
  "name": "Ali Hassan",          // REQUIRED
  "phone": "+20100…",            // optional
  "archived": false              // optional — account deleted on Veeey → archive here
}
```

**YeldnIN sets (not sent):** `scope = VEEEY`, `contactChannel = VEEEY` (new
seeded channel — "this customer came from the storefront"), `veeeyCustomerId`
stored on the existing column.

**Matching order:** by `veeeyCustomerId`; else (first push only) an existing
scope-`VEEEY` customer with the exact same name adopts the link; else create.

**Response:** `200 {"ok":true,"customerId":n,"created":bool}`.

## 3. Read-only enforcement in YeldnIN (UI + server actions)

- Scope-`VEEEY` **products**: Veeey-owned fields render read-only; the
  YeldnIN-owned fields (§0 row 3) stay editable by Purchasing/Logistics/Ops —
  including the heavy toggle. Product **create** in YeldnIN becomes
  XOONX/PERSONAL-only.
- Scope-`VEEEY` **customers**: name/phone/channel read-only; internal
  customer notes (YeldnIN feature) remain editable. Customer create in YeldnIN
  becomes XOONX-only.
- Enforced server-side in the actions, not just hidden in the UI (same pattern
  as the golden-rule guards).

## 4. Deletes & lifecycle

- Veeey **unpublish/draft** → not sent, no-op in YeldnIN (YeldnIN controls its
  own `active`).
- Veeey **hard-delete** → `archived: true` → YeldnIN **soft-archives**
  (`archivedAt`); never hard-deletes (history/items reference the row).
- YeldnIN never deletes or deactivates anything on Veeey (no outbound catalog
  channel exists at all).

## 5. Freshness

- **Primary:** Veeey emits an upsert on every product/customer create/update
  (near-real-time).
- **Safety net:** nightly full sweep — Veeey re-pushes the full catalog +
  customers (idempotent upserts make this cheap); heals missed events and
  drift.

## 6. Cutover from the legacy WooCommerce sync

1. **Until new-Veeey launch:** the existing wpId-keyed `/catalog` sync from the
   old site keeps running unchanged.
2. YeldnIN ships `/products/upsert` + `/customers/upsert` (this contract)
   alongside it.
3. At launch, new Veeey pushes the **full catalog with `legacyWpId`** → the
   2,548 already-linked products adopt their SKUs automatically (match rule
   §1.2); then the full registered-customer push.
4. Verify counts/spot-checks (Settings → Integrations), then **retire
   `/catalog`** and the old-site webhook.
5. Ops note: arm the inbound API key on prod (Settings → Integrations —
   `inboundKeyAt` is currently null) before step 3.

## 7. Veeey-side obligations (built in the Veeey session, not YeldnIN)

- SKU auto-generation: numeric product id as SKU; `ID-N` per variation; SKU
  immutable once assigned; retained `legacyWpId` included on pushes.
- New **`type`** product field (SUPPLEMENT | DEVICE | INJECTION), populated for
  the full existing catalog (one-time editorial task).
- Distinct variation names (base name + attributes).
- Emit product/customer upserts on change + the nightly sweep; filter guests
  out of customer pushes.
- v1 §4.2's `estimatedWeight` and `defaultSupplierName` are **dropped** — do
  not send; weight and supplier are YeldnIN-owned.

## 8. Config note for the re-baseline

v1 §7 describes env-var config (`INTEGRATION_ENABLED`, secret, webhook URL).
YeldnIN's live implementation manages the provider record (enabled flag, base
URL, encrypted secrets, inbound key) in **Settings → Integrations** — treat that
as authoritative; the env-var table in v1 should be updated to match when the
full contract is re-baselined.
