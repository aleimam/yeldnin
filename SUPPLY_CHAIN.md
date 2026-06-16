# YeldnIN — Supply Chain design (draft for review)

> Foundation spec for the supply-chain modules (Sales, XOONX, Purchasing, Logistics,
> Operations, Couriers, Issues & Compensations, History). Derived from
> `YeldnIN Description.docx` + `Status.xlsx`. **Design only — nothing here is built yet.**
> Review and correct before we start Phase 4.

## 1. Core concepts

- **Unit** — the things tracked: **Items** (physical instances of products), **Products** (catalog), **Partners/People** (Customers, Suppliers, Travelers, Couriers), Users.
- **Item** — *one physical unit*. The atomic tracked thing. A Request line "Count = 3 of Product X" creates **3 Item rows**. An Item carries: `productId`, `scope`, current container, canonical `status`, and flags. Moving an item = re-pointing it to another container.
- **Container** — a basket that holds items along the path Supplier → Customer:
  `Supplier → Request → Purchase → Patch → Traveler → Trip → (Hub) → (Transfer) → Shipment → Office → Website → Order → Delivery → Courier → Customer`.
- **Pool** — a *view* of items currently sitting at a stage (e.g. requested-not-yet-purchased). Plus four **exception pool containers**: **Lost / Damaged / Errant / Delayed** — shared buckets that collect flagged items from anywhere; each item **remembers its source container**.
- **Scope** — `EGV` (Egypt Vitamins) · `XOONX` · `PERSONAL`. A hard data boundary that drives visibility.

## 2. The canonical item status (one source of truth)

Every item has **one** status. Each container/team just relabels it. (From `Status.xlsx`.)

| # | Canonical status | Trigger | Container status at that point |
|---|---|---|---|
| 1 | Requested | Sales/XOONX/admin place request | — |
| 2 | Ordered | Purchasing buys it | Purchase: New |
| 3 | Shipped | added to a Patch | Purchase/Patch: Dispatched |
| 4 | Delivered | Purchase/Patch marked delivered | Purchase/Patch/Hub: Delivered |
| 5 | Hub | received at hub/traveler | Purchase/Patch/Hub/Trip: Received |
| 6 | Transit | **auto** `received_at + random(2–4 days)` | — |
| 7 | Global Shipping | **auto** `received_at + random(4–6 days)` (≥ Transit) | — |
| 8 | Customs | Trip → In Egypt | Trip: In Egypt |
| 9 | Out for Delivery | Trip → Ready to pickup | Trip: Ready to pickup |
| 10 | Office | Trip/Shipment → Picked up | Trip/Shipment: Picked up |
| 11 | Photos Sent | Operations send pickup photos | Trip/Shipment: Photos Sent |
| 12 | Website | (later) Veeey adds shipment to site | Trip/Shipment: Website |

**Time engine** — steps 6–7 are advanced by a **scheduled worker** off `received_at` with random offsets (Global Shipping clamped ≥ Transit).

### 2.1 Status Map editor (admin-configurable — decision "A")

The **workflow itself is fixed in code** — the stages, transitions, triggers, and system behaviors (shipment split, issue creation, scope routing, auto-advance timers) are anchored to **stable status keys** that the business logic depends on. What admins edit, from **Settings → Status Map**, is the *presentation & tuning* layer:
- **Status labels** — rename every status (EN+AR).
- **Status map** — the Excel-style grid: for each view (Sales-normal · Sales-special · Purchase · Patch · Hub · Transfer · Trip · Shipment · Office) which label shows at each step, including blank = *carry-forward*; plus **show/hide** a status per view.
- **Timers** — the auto-advance day ranges (e.g. 2–4, 4–6).
- *(optional)* **display-only sub-statuses** mapped onto an existing stage (cosmetic; no logic).

Admins **cannot** add/remove/reorder the underlying stages or rewire transitions — that requires a code change (keeps the engine unbreakable). Labels + map are **seeded from `Status.xlsx`**.

### Container-internal status flows
- **Purchase**: New → Dispatched → Delivered → Received
- **Patch**: Dispatched → Delivered → Received
- **Hub**: Delivered-to-hub → Received-by-hub → Shipped-to-dest → Delivered-to-dest → Received-in-dest
- **Transfer**: New → Left Origin → Delivered-to-dest → Received-in-dest
- **Trip**: New → Approved → Started Shipping → Completed Shipping → Completed Receiving → Waiting Trip → Traveling → In Egypt → Ready to pickup → Picked up → Photos Sent → On Website (Complete) · *Cancelled*
- **Shipment**: Out for Delivery (= Ready to pickup) → Received (= Picked up) → Photos Sent → Website
- **Order**: Ordered → Dispatched → Delivered → Received

### Flags
Item-level **Delayed / Errant / Lost / Damaged** → set a *partial* flag on the container; a container-level flag applies to all its items. Flagged items move to the matching exception pool.

## 3. Sales-facing status (derived view)

Sales see **item statuses only — never container statuses**, and never Trips/Travelers.

- **Special-order items** (a customer is waiting): milestone view = the sheet's Special-Order column with **carry-forward** through blank steps →
  Requested → Ordered → Shipped *(holds through Delivered/Hub/Transit)* → Global Shipping *(holds through Customs)* → Out for Delivery → Office → Photos Sent → Website.
- **Non-special items** (restock/out-of-stock/optional): **light tracking** — Sales mainly need "is it on the Website yet?". The full canonical status still exists internally for supply-chain/admins.

## 4. Data model (entities & key fields)

**People / partners**
- **Customer** — name*, contactChannel (WhatsApp default · Phone · Direct · Facebook · Instagram), contactNumber.
- **Supplier** — name, country (USA/UK/EU…), availability per scope (existing in pricing).
- **Traveler** — name, contact, notes, photos, reference (→ another traveler), active, blacklisted, staticAddress, carriesMaleSupport, allowedProductTypes[].
- **Courier** — delivery partner.

**Catalog**
- **Product** — name, SKU, **scope** (EGV/XOONX/Personal), **type** (Supplements · Devices · Injection · Heavy Supplements · XOONX), defaultSupplier (+country; default Amazon), weight(g), size, grade, URL, notes, isMaleSupport, images[].
  *Add rules:* Sales+Purchasing → EGV only; XOONX+Purchasing → XOONX only; admins → all.

**Containers**
- **Request** — type (Special Order · Out of Stock · Restock · Optional; default Restock), customer (required iff Special Order; creatable inline), lines[] (product, count, sellingPrice, purchasePrice, notes), photos (only if Special Order).
- **Purchase** — scope, country, supplier (cascading from the pending pool), purchasePrice, destinationType (Hub | Trip), destination, notes. *Rules:* only requested-not-purchased items; only to Trips with status Approved/Started Shipping whose Last-Receiving-Date is in the future.
- **Patch** (Supplier → Hub/Traveler) — country & supplier (inherited), dispatchDate (auto), deliveryDate (auto on Delivered), tracking, courier, items[], notes, photos.
- **Transfer** (Destination → Destination) — createdDate, fromDestination, toDestination, items[], note, photos.
- **Hub** — name*, country*, notes, photos; **has inventory**; can transfer inventory to another destination *in the same country*.
- **Trip** — country, traveler, maxWeight, dealPricePerKg, lastReceivingDate (= trip date), deliveryDateInEgypt, allowedProductTypes (inherit), maleSupport (inherit), notes. **Traveler & Trip share one inventory** (interchangeable).
- **Shipment** — auto-generated when a Trip is picked up & approved (see §6).
- **Order / Delivery / Courier** — the Egypt-side delivery leg to the customer.

**Issues**
- **Issue** — opened from a trip-review Issue mark or a Lost/Damaged event; note + photos; lifecycle until solved.
- **Compensation** — type Product (pick from lost/damaged items; supplier sends a **new Purchase at price 0**) or Money (EGP amount; traveler).
- **Gift** — free products added to a Purchase (product, count, notes, photos).

**Everything interconnects** — every unit page links to its connected units (the "connections graph").

## 5. Pools

- **Stage pools** (views): per stage, the items currently there — e.g. *Pending-purchase pool* = requested-not-yet-purchased, grouped by scope. Purchasing buys from it; purchased items deduct; **cancelled / lost / damaged items return** to it.
- **Exception pools** (real buckets): **Lost / Damaged / Errant / Delayed**. Flagged items move here from any source and remember it. **Delayed** items also link back to their **traveler** to rejoin the next trip.

## 6. Key algorithms

**Trip → Shipments** (on admin approval of a picked-up trip):
1. **XOONX** items → one separate shipment (XOONX + admins see).
2. **Personal** items → one separate shipment (admins only).
3. **EGV** items: if **< 20** → one shipment. If **≥ 20** → split:
   - **Hard:** ≤ 19 items/shipment; ≤ 5 of the same product/shipment.
   - **Soft:** aim ≥ 10/shipment and 2–3 of the same product, distributed evenly. **Min size may be broken** to honor the per-product cap.
   - **Only Supplements + Heavy Supplements count** toward the 20 threshold and sizing; Devices/Injection ride along **uncounted**.

**3-team trip review** — Purchasing, Logistics, Operations each mark **OK | Issue** (note + photos). Each team sees **only its own mark**; admins see all in one row (e.g. *Purchasing OK · Logistics OK · Operations Issue*). An Issue mark auto-opens an Issue. Marks are changeable until an **admin** approves: **OK** → split into shipments (above); **Hold** → notify teams to re-review. Everything is logged (admin-visible). Logistics may pull items off the trip → traveler (Delayed).

**Traveler ↔ Trip inventory** — shared & interchangeable; a traveler's inventory auto-allocates to their nearest trip; items not arriving with the trip fall back to the traveler as **Delayed**.

**Compensations** — created from an Issue: Product (replacement → new Purchase @ 0) or Money (EGP).

## 7. Visibility & permissions

- **Scope-filtered shipments**: EGV → EGV+admin · XOONX → XOONX+admin · Personal → admins only. (Row-level scoping on queries.)
- **Sales** never see logistics/purchasing, Trips, Travelers, or container statuses — items + Sales-status only.
- **Purchasing & Logistics** view requests + products; **Purchasing** can add products, **Logistics** cannot.
- **Permissions use the Phase B model** (per-user capability levels). Each module's actions become capabilities in the Phase B catalog as we build it.

## 8. Cross-cutting

- **Photos golden-condition** everywhere (upload/paste/drag-drop, thumbnails, click-to-enlarge, multi) — reuse `PhotoUpload`.
- **Bilingual EN/AR + RTL** — existing i18n.
- **Friendly names** per container (e.g. "3 × Requested from Supplier to Customer by Sales User") — **TBD, wording to come.**
- **Veeey integration** (inbound "Website" signal) — **later.**
- **PWA + web push** — **in scope, later phase.**

## 9. Proposed build sequence (Phase 4)

1. **State-machine core + master data + item/container model** — the (code-defined) item/container state machine + scheduled timer worker, with a **Settings → Status Map** editor for labels/map/visibility/timers over stable status keys (seeded from `Status.xlsx`); plus Products, Customers, Suppliers, Travelers, Hubs, scope, and the Item model. *This is the backbone everything plugs into.*
2. **Sales** — Requests + pending pool.
3. **Purchasing** — Purchases from pool + Patches + Gifts.
4. **Logistics** — Trips, Travelers, Transfers, Hub inventory, receiving.
5. **Operations** — trip pickup, 3-team review, shipment split, photos.
6. **Couriers / Orders / delivery** + Website handoff.
7. **Issues & Compensations**, then **History**.
8. **PWA / web push**, then **Veeey** integration.

## 10. Open items (TBD)
- Friendly-name wording for each container.
- Veeey integration mechanism (API/shared DB/manual).
- Order/Delivery/Courier field details (thin in the source doc).
