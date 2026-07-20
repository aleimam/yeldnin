# Veeey ↔ YeldnIN Contract v2 — Deliveries slice (DRAFT — pending owner approval)

> **Type 2** of the shipments work: customer deliveries fulfilled by our own
> couriers. Companion to `INTEGRATION_V2_PRODUCTS_CUSTOMERS.md`; reuses its
> transport (HMAC §1, idempotency §2, error envelope §3) unchanged.
>
> **Type 1 (supply → stock) is deliberately NOT in this document.** It is blocked
> until egyptvitamins.net is retired and veeey.net becomes the stock master —
> until then the 10-minute net-sync would wipe anything YeldnIN writes to stock.
> See §8.
>
> Target store: **veeey.net**. Designed so veeey.com can adopt it unchanged.

---

## 0. Vocabulary — two different words, on purpose

| Term | Meaning | Direction |
|---|---|---|
| **Shipment** | Supply chain → our stock (type 1, later) | YeldnIN → Veeey |
| **Delivery** | An order → the customer, by our own courier | Veeey → YeldnIN, tracking back |

Never call a Delivery a "shipment". The whole point of two words is that nobody
ever has to ask which one is meant.

**Carrier name: "VEEEY Express"** — stored as an editable EN/AR setting in each
store, never hard-coded, so renaming is an admin edit rather than a deploy.

## 0.1 Ownership (the one-writer rule)

| Owner | Fields |
|---|---|
| **Veeey** | the order and everything on it, customer identity, address, line items, COD amount, **all customer-facing wording** |
| **YeldnIN** | the delivery record, courier assignment, delivery status, promised date + slot, courier notes, cash-collected figure, delivery photo |

YeldnIN sends **status codes**; Veeey maps them to its own bilingual customer
text. Back-office systems must not dictate storefront copy.

---

## 1. Delivery lifecycle

```
   Veeey Ops mark      ┌─────────┐
   order shipped  ───► │   NEW   │  in YeldnIN, no courier yet
   + VEEEY Express     └────┬────┘
                            │  YeldnIN Ops assign a courier
                    ┌───────▼──────┐
                    │   ASSIGNED   │  courier has it, going out today
                    └──────┬───────┘
                    ┌──────▼────────────┐
                    │ OUT_FOR_DELIVERY  │  he has actually left
                    └──────┬────────────┘
        ┌──────────┬───────┼─────────┬──────────┐
        ▼          ▼       ▼         ▼          ▼
   DELIVERED  RESCHEDULED DELAYED  FAILED   CANCELLED
      ✅       (customer)  (courier)  │      (customer
                  └────┬────┘         │       doesn't want it)
                   back to       Ops decides       │
              OUT_FOR_DELIVERY                goods return
```

- **`NEW`** — the delivery exists but no courier is chosen. Veeey Ops create it;
  YeldnIN Ops assign. Without this state there is nowhere to put a delivery
  between those two moments.
- **`ASSIGNED` and `OUT_FOR_DELIVERY` are deliberately separate.** A customer
  seeing "out for delivery" for six hours in the Cairo summer assumes something
  is wrong. The customer only sees the second state.
- **`RESCHEDULED` (customer asked) vs `DELAYED` (courier didn't make it)** are
  distinct so customer-caused and courier-caused slippage can be told apart.
  Both are non-terminal and return to `OUT_FOR_DELIVERY`.

### 1.1 `FAILED` vs `CANCELLED` — one rule, no overlap

These two are easy to conflate, and if couriers record the same situation
differently the failure statistics become meaningless. The dividing line is
**whether the customer declined**:

- **`CANCELLED`** — the customer doesn't want it. **Refusal at the door counts
  here.** Goods return.
- **`FAILED`** — the courier could not complete the attempt and the customer
  never declined: nobody home, unreachable, wrong address.

Failure reason codes: `NOT_HOME | UNREACHABLE | WRONG_ADDRESS | NO_CASH |
DAMAGED | OTHER`. Free text never aggregates.

> `REFUSED` is deliberately **absent** — refusal is `CANCELLED`, never `FAILED`.
> `NO_CASH` (customer has nothing to pay with) is its own code because it is a
> common COD outcome that fits none of the others.

### 1.2 Retrying

A delivery may bounce between `RESCHEDULED`/`DELAYED` and `OUT_FOR_DELIVERY`
**with no hard limit**, until Sales, the courier or Ops decide it is `CANCELLED`
or `FAILED`. Humans close it, not a counter.

> Suggested (not required): flag a delivery for Ops attention after **3** bounces.
> Not a block — just visibility, so a delivery cannot quietly cycle for weeks
> with nobody noticing.

### 1.1 Promised date + slot

Every delivery carries a **promised date** and a **4-hour slot**:

```
10:00–14:00   ·   14:00–18:00   ·   18:00–22:00
```

Settable by **Ops or the courier** (a courier rescheduling sets the new one).
Fixed slots beat free times: a predictable promise for the customer, batchable
routes for Ops, and one enum to validate instead of two invertible timestamps.

---

## 2. Events

### 2.1 `delivery.created` — Veeey → YeldnIN

Fired when **Ops marks the order shipped and selects VEEEY Express**. Never on
order placement — that would create deliveries for orders cancelled minutes later.

```jsonc
{
  "storeKey": "veeey.net",          // REQUIRED — veeey.net | veeey.com
  "orderNumber": "V-10432",          // REQUIRED — correlation key, unique per store
  "placedAt": "2026-07-20T09:12:00Z",
  "customer": { "name": "…", "phone": "+20…", "altPhone": "+20…" },
  "address": {                       // all three parts — couriers use all of them
    "zone": "Nasr City", "subArea": "1st District",
    "text": "12 Ahmed Fakhry St, flat 4",
    "mapUrl": "https://…"            // optional
  },
  "lines": [ { "sku": "VEY-…", "name": "…", "qty": 2 } ],  // labels only, NOT foreign keys
  "collectAmountEgp": 145000,        // piastres. 0 = prepaid, nothing to collect
  "paymentMethod": "COD",            // COD | PREPAID
  "promisedDate": "2026-07-21",      // optional; Ops may set it later in YeldnIN
  "promisedSlot": "14:00-18:00",
  "notes": "Call before arriving"
}
```

**Deliveries are self-contained.** `lines` carry SKU and name as *labels*, not
foreign keys, and the customer is denormalised rather than linked.

> **Why this matters:** YeldnIN's VEEEY-scope catalogue came from veeey.**com**
> (numeric SKUs) while veeey.**net** has its own `VEY-…` SKU space, and both
> stores hold ~16k customers who are largely the *same people* with different
> ids. Linking would collide on both. Self-contained deliveries sidestep it
> entirely and work identically for either store.

**Response:** `200 {"ok":true,"deliveryUid":"DLV2607001","status":"ASSIGNED"}`

### 2.2 `delivery.cancel` — Veeey → YeldnIN

The customer cancelled after the delivery existed.

```jsonc
{ "storeKey": "veeey.net", "orderNumber": "V-10432", "reason": "customer_cancelled" }
```

- Accepted while `ASSIGNED` or `OUT_FOR_DELIVERY` → delivery becomes `CANCELLED`
  and **the assigned courier is notified**.
- **Rejected once `DELIVERED`** → `409` returning the current status and
  timestamp, so Veeey can reconcile rather than silently diverge. A courier who
  has already handed over goods cannot un-deliver them.

### 2.3 `delivery.tracking` — YeldnIN → Veeey

Every status change.

```jsonc
{
  "storeKey": "veeey.net",
  "orderNumber": "V-10432",
  "deliveryUid": "DLV2607001",
  "status": "DELAYED",
  "at": "2026-07-20T15:40:00Z",      // when it happened, not when it was sent
  "courierName": "Mahmoud A.",
  "promisedDate": "2026-07-22",
  "promisedSlot": "18:00-22:00",
  "reason": "NOT_HOME",               // failures only
  "collectedAmountEgp": 145000,       // on DELIVERED
  "reviewFlag": true,                 // the Yellow Flag — see §3
  "note": "Customer took 3 of 5 items",
  "photoUrl": "https://veeey.net/uploads/deliveries/…"  // after §5 upload
}
```

---

## 3. The Yellow Flag, and why the order is never edited by the sync

When something doesn't match — partial hand-over, wrong item, a different amount
collected — the courier or Ops raises a **Yellow Flag** with a note. That flags
the order for Ops review in Veeey. **Sales then edits the order manually**, and
only afterwards is it moved to Delivered.

**The sync never edits an order.** It reports what happened; a human decides what
the order should say.

Two reasons this ordering is right:

1. **Editing before `DELIVERED` keeps the money correct.** Veeey derives lifetime
   spend, tier and loyalty points from *delivered* orders, so an edit made before
   that transition is counted once, from the corrected figure.
2. **It preserves the discrepancy.** The delivery keeps what the courier reported
   (`collectedAmountEgp`, note, photo) while the order keeps what Sales entered.
   Both remain visible, so an odd number can still be spotted later — which is
   what phase-2 cash settlement will depend on.

---

## 4. Order statuses

Veeey's order status is a text code backed by a table and editable at
`/admin/order-statuses`, so these are **configuration, not a migration**.

| New status | Meaning |
|---|---|
| **Cancelled** | Customer declined — decision made |
| **Returned** | Goods physically back with Ops |
| **Refunded** | Money actually returned to the customer |

**COD orders end at `Returned`.** Nothing was ever collected, so there is nothing
to refund; auto-advancing them to `Refunded` would inflate refund counts and
values with orders that never had a payment — and COD is most of the volume.
Group `Returned + Refunded` in reporting queries if a single "closed" view is
wanted; don't collapse them in the data.

### ⚠️ 4.1 Stock restore — fires once, on one of two triggers

Veeey currently restores stock on `committed → CANCELLED/REFUNDED`. With the
order now able to walk **Cancelled → Returned → Refunded**, that would fire
**three restores for one order**, so the rule changes.

Restock when the goods become available again — which happens in exactly two ways:

**Stock is deducted at order confirmation.** So the boundary is simply whether
the order has since reached **shipped**:

| Transition | Restock? | Why |
|---|---|---|
| `Cancelled` **before shipped** | ✅ | Never left the warehouse; available immediately |
| `Cancelled` **after shipped** | ❌ | Goods are with the courier — wait for `Returned` |
| `Returned` | ✅ | Physically back |
| `Refunded` | ❌ never | Money-only event; the goods were already handled |

It fires **once**, on whichever comes first: cancelled-while-unshipped, or
returned.

Two guards:
- The test is the **order's shipped state**, not "does a delivery record exist" —
  orders shipped via Aramex or SMSA never have one, and must behave identically.
- Restock only if a **SALE was actually recorded** for that order. An order
  cancelled *before* confirmation never deducted stock, so restoring it would
  invent inventory. Veeey's outbox already records SALE on the first
  CONFIRMED/SHIPPED/DELIVERED entry, so it knows.

> **⚠️ "Restock only at `Returned`" is not sufficient.** An order cancelled
> before it ships never reaches `Returned` — nothing comes back, because nothing
> left — so its committed stock would stay decremented permanently. That is
> likely the most common cancellation of all.

`NetStockOutbox`'s unique key `(orderId, wpId, direction)` gives exactly-once,
but it must be **verified against the new statuses, not assumed**. This is the
class of bug that silently distorts stock for weeks before anyone notices.

### 4.2 What the customer sees

Delivery detail appears as a **tracking line with a date**, under a coarse order
status — not as new order statuses. The order vocabulary is already 11 values;
`RESCHEDULED`/`DELAYED` are transient sub-states of "out for delivery", and **the
date reassures far more than the label does**.

| Delivery status | Customer sees |
|---|---|
| `NEW` | Preparing your delivery |
| `ASSIGNED` | Scheduled for delivery — Tuesday |
| `OUT_FOR_DELIVERY` | Out for delivery today |
| `RESCHEDULED` | Rescheduled at your request — Thursday |
| `DELAYED` | Delayed — now arriving Thursday |
| `DELIVERED` | Delivered |
| `FAILED` | We couldn't complete delivery — we'll contact you |
| `CANCELLED` | Cancelled |

`DELAYED` never apportions blame to the customer. `RESCHEDULED` may say "at your
request", because it confirms something they did.

---

## 5. Couriers

**A courier is a `User` with `tier = THIRD_PARTY`** — an existing concept
described in `access-logic.ts` as *"an external account (supplier/partner). Logs
in, no employee."*

- **No HR record.** `users/actions.ts` already skips `ensureEmployee` for
  THIRD_PARTY — no attendance, no payroll. Nothing to build.
- **Phone login.** `User.username` is already an optional login handle ("login
  with username OR email"), so the phone goes there and a **PIN** is the
  password through the existing bcrypt path — inheriting session cookies, login
  lockout and `tokenVersion` revocation.
- **Ops staff are couriers too.** `Courier` gains an optional `userId`: set for
  Ops staff (who log in normally), unset for dedicated couriers with a PIN. One
  roster, one assignment picker, both populations.

> **⚠️ A phone number is not a secret.** It is on every contact list. Without the
> PIN, anyone knowing a courier's number could read every customer's name,
> address and cash amount. The PIN is the minimum acceptable factor.

### 5.1 Access — the part most likely to be got wrong

YeldnIN's permissions are per-**module**, with no notion of "only your own rows".
A courier granted VIEW on Deliveries the ordinary way **sees everyone's
deliveries** — every address, phone and COD amount in the system.

Therefore:
- Delivery queries **filter by the signed-in user's courier id**, server-side.
- The detail page **404s** on someone else's delivery. Not merely unlinked — the
  by-id path is the one that gets abused.
- Every module except Deliveries is NONE; the courier lands directly on
  "My deliveries", never a dashboard of things they cannot open.

**Ops see every delivery; a courier sees only their own.** Within their own, a
courier sees **everything** — address, phone, line items and COD amount included.
The restriction is *which* deliveries, never *how much* of one.

---

## 6. Photos

Optional proof-of-delivery, attached by the courier.

- **Optional but prompted** on `DELIVERED`. Mandatory would strand a courier with
  a dead battery or no signal.
- **Shown to the customer** → therefore **YeldnIN uploads the image to Veeey**,
  which stores and serves it. YeldnIN's own asset routes are scope-gated and
  internal, so they cannot serve a public storefront image.
- **Retention 180 days**, enforced on both sides. These are photographs of
  customers' homes.
- In YeldnIN, delivery photos are **scope-gated by id** like product and request
  photos — only the assigned courier and Ops can open one.

### ⚠️ 6.1 The upload guard needs a narrow exception

`src/app/api/upload/route.ts` **blocks THIRD_PARTY uploads outright** (as does
`documents/import-docx`), added deliberately after a photo-upload incident.

The exception must be exactly: *a THIRD_PARTY user may upload **one delivery
photo**, **only** to a delivery assigned to them.* Relaxing the guard generally
would hand every external supplier account a file-upload surface.

---

## 7. Transport rules

Reuses contract v1 §1 auth (HMAC-SHA256, timestamp + nonce) and §2 idempotency.

- **Idempotent** on `(storeKey, orderNumber)` for creation and `Idempotency-Key`
  per event. A retried push must never create a second delivery.
- **Status regression is rejected.** Tracking events can arrive late or out of
  order; a stale `OUT_FOR_DELIVERY` must never overwrite a newer `DELIVERED`.
  Rank the statuses and refuse to move backwards, returning the current state.
- **`at` is when it happened**, not when it was sent — ordering is decided by
  that, not by arrival.
- **Scope guard:** deliveries are VEEEY-scope only. A XOONX or PERSONAL record
  must never be reachable through this channel.

---

## 8. Explicitly NOT in phase 1

- **No stock movement.** A return does **not** restock — it flags for Ops. Until
  egyptvitamins.net retires and veeey.net becomes stock master, the 10-minute
  net-sync would wipe anything YeldnIN writes. This lifts with type 1.
- **No cash settlement.** The delivery *carries* `collectAmountEgp` and records
  `collectedAmountEgp`, but courier float, daily cash-up and reconciliation are
  phase 2. Carrying the numbers now is what makes phase 2 possible later.
- **No per-line delivered quantities.** The Yellow Flag plus a note covers it.
- **No type 1 (supply shipments).**

---

## 9. Prerequisites before any of this can run

1. ~~**veeey.net has no integration link.**~~ ✅ **DONE (verified 2026-07-20).**
   The live `ApiIntegration` row on in.yeldn.com is `enabled`, holds a stored
   secret, and its `baseUrl` is `https://veeey.net`, with `lastTestOk = true` at
   2026-07-19 18:59 UTC. The secret exchange and signed round-trip happened.

   > Two consequences worth stating, because they change the plan:
   >
   > - **No multi-client work is needed.** `ApiIntegration` is a table keyed by
   >   `provider`, but every read hardcodes `"VEEEY"` and `verifyInbound`
   >   resolves one secret regardless of `X-Client-Id`. That is fine while
   >   exactly ONE store is connected, which is the case: the single row points
   >   at veeey.net. Multi-client only becomes real when veeey.com is linked
   >   *alongside* it — and it will need more than a second row, because both
   >   stores run the same codebase and would send the same `X-Client-Id`, so the
   >   client id must become env-driven on their side before a secret can be
   >   resolved per store. Do not build this until that day arrives.
   > - **The outbox is empty**, so nothing has traversed the channel in anger —
   >   `lastTestOk` reflects the health test, not a real payload.
2. **YeldnIN needs the Deliveries module** — the `couriers` module relabelled
   (see §10), plus the delivery model, Ops screens and the courier view.
3. **Veeey needs** the VEEEY Express carrier option, the Ops "mark shipped"
   trigger, the tracking display, and the three new order statuses.

---

## 10. Module placement

**Rename the `couriers` module's label to "Deliveries"; keep the internal key
`couriers`.** Permissions are keyed by module in `UserModulePermission`, so
changing the key would break every existing grant and require a data migration.
The courier roster becomes a tab inside.

This leaves a key/label divergence — the same precedent as `sla.egv` displaying
as "Veeey". Invisible to users, documented here, and it avoids touching the
permission system.

---

## 11. Open / deferred

- Type 1 (supply shipments → stock), on egyptvitamins.net retirement.
- Cash settlement and courier float (phase 2).
- Whether veeey.com also adopts VEEEY Express — the design already supports it
  via `storeKey`.
