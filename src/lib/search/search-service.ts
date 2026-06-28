import "server-only";
import { prisma } from "@/lib/db";
import type { Access } from "@/lib/auth/access";
import { getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";
import { productScopes } from "@/lib/products/products-logic";
import { requestScopes } from "@/lib/requests/request-logic";
import { customerScopes } from "@/lib/customers/customers-logic";
import { parseQuery, isSearchable, uidPrefix, UID_PREFIX_TYPE, type ParsedQuery } from "./search-logic";
import { formatBizDate } from "@/lib/format/dates";

export interface SearchHit {
  type: string;
  id: number;
  uid: string | null;
  title: string;
  subtitle: string | null;
  href: string;
}
export interface SearchGroup {
  type: string;
  labelKey: string;
  hits: SearchHit[];
}

interface EntityDef {
  type: string;
  labelKey: string;
  run: () => Promise<SearchHit[]>;
}

// UID query → match the uid prefix; text query → OR over the given fields.
// Returns `any` so it can spread into each model's distinct Prisma where input.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clause(parsed: ParsedQuery, textFields: string[]): any {
  if (parsed.kind === "uid") return { uid: { startsWith: parsed.uid } };
  return { OR: textFields.map((f) => ({ [f]: { contains: parsed.text } })) };
}

/** Permission/scope-aware global search, grouped by entity type. */
export async function globalSearch(access: Access, raw: string, perType = 6): Promise<SearchGroup[]> {
  if (!isSearchable(raw)) return [];
  const parsed = parseQuery(raw);
  const can = (m: string) => access.canModule(m, "VIEW");
  const pScopes = productScopes(access, "VIEW");
  const rScopes = requestScopes(access, "VIEW");
  const cScopes = customerScopes(access, "VIEW");

  const defs: EntityDef[] = [];

  if (pScopes.length) {
    defs.push({
      type: "product",
      labelKey: "products.title",
      run: async () => {
        const rows = await prisma.product.findMany({
          where: { archivedAt: null, scope: { in: pScopes }, ...clause(parsed, ["name", "sku", "uid"]) },
          select: { id: true, uid: true, name: true, scope: true },
          take: perType,
          orderBy: { updatedAt: "desc" },
        });
        return rows.map((r) => ({ type: "product", id: r.id, uid: r.uid, title: r.name, subtitle: r.scope, href: `/products/${r.id}` }));
      },
    });
  }

  if (rScopes.length) {
    defs.push({
      type: "request",
      labelKey: "requests.title",
      run: async () => {
        const rows = await prisma.request.findMany({
          where: { archivedAt: null, scope: { in: rScopes }, ...clause(parsed, ["uid", "notes"]) },
          select: { id: true, uid: true, type: true, scope: true, customer: { select: { name: true } } },
          take: perType,
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({ type: "request", id: r.id, uid: r.uid, title: r.customer?.name ?? r.scope, subtitle: r.scope, href: `/requests/${r.id}` }));
      },
    });
  }

  if (cScopes.length) {
    defs.push({
      type: "customer",
      labelKey: "customers.title",
      run: async () => {
        const rows = await prisma.customer.findMany({
          where: { archivedAt: null, scope: { in: cScopes }, ...clause(parsed, ["name", "contactNumber", "uid"]) },
          select: { id: true, uid: true, name: true, contactNumber: true },
          take: perType,
          orderBy: { updatedAt: "desc" },
        });
        return rows.map((r) => ({ type: "customer", id: r.id, uid: r.uid, title: r.name, subtitle: r.contactNumber, href: `/customers/${r.id}` }));
      },
    });
  }

  if (can("purchasing")) {
    defs.push({
      type: "purchase",
      labelKey: "purchasing.purchases",
      run: async () => {
        const rows = await prisma.purchase.findMany({
          where: { archivedAt: null, ...clause(parsed, ["uid", "supplierName", "destinationName"]) },
          select: { id: true, uid: true, supplierName: true, scope: true },
          take: perType,
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({ type: "purchase", id: r.id, uid: r.uid, title: r.supplierName ?? r.scope, subtitle: r.scope, href: `/purchasing/purchases/${r.id}` }));
      },
    });
  }

  if (can("logistics")) {
    defs.push({
      type: "patch",
      labelKey: "patches.title",
      run: async () => {
        const rows = await prisma.patch.findMany({
          where: { archivedAt: null, ...clause(parsed, ["uid", "tracking", "supplierName", "destinationName"]) },
          select: { id: true, uid: true, tracking: true, destinationName: true },
          take: perType,
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({ type: "patch", id: r.id, uid: r.uid, title: r.destinationName ?? r.tracking ?? "—", subtitle: r.tracking ?? r.destinationName, href: `/patches/${r.id}` }));
      },
    });
    // Sales-only members never get Trip / Traveler hits.
    if (!access.hidesTripTraveler) {
      defs.push({
        type: "trip",
        labelKey: "trip.title",
        run: async () => {
          const rows = await prisma.trip.findMany({
            where: { archivedAt: null, ...clause(parsed, ["uid", "country", "notes"]) },
            select: { id: true, uid: true, country: true, traveler: { select: { name: true } }, lastReceivingDate: true },
            take: perType,
            orderBy: { createdAt: "desc" },
          });
          return rows.map((r) => ({ type: "trip", id: r.id, uid: r.uid, title: r.traveler.name, subtitle: r.lastReceivingDate ? formatBizDate(r.lastReceivingDate) : r.country, href: `/trips/${r.id}` }));
        },
      });
      defs.push({
        type: "traveler",
        labelKey: "travelers.title",
        run: async () => {
          const rows = await prisma.traveler.findMany({
            where: { archivedAt: null, ...clause(parsed, ["name", "contact", "uid"]) },
            select: { id: true, uid: true, name: true, contact: true },
            take: perType,
            orderBy: { updatedAt: "desc" },
          });
          return rows.map((r) => ({ type: "traveler", id: r.id, uid: r.uid, title: r.name, subtitle: r.contact, href: `/travelers/${r.id}` }));
        },
      });
    }
    defs.push({
      type: "hub",
      labelKey: "hubs.title",
      run: async () => {
        const rows = await prisma.hub.findMany({
          where: { archivedAt: null, ...clause(parsed, ["name", "country", "uid"]) },
          select: { id: true, uid: true, name: true, country: true },
          take: perType,
          orderBy: { updatedAt: "desc" },
        });
        return rows.map((r) => ({ type: "hub", id: r.id, uid: r.uid, title: r.name, subtitle: r.country, href: `/hubs/${r.id}` }));
      },
    });
  }

  if (can("operations")) {
    defs.push({
      type: "shipment",
      labelKey: "shipments.title",
      run: async () => {
        const rows = await prisma.shipment.findMany({
          where: { archivedAt: null, ...clause(parsed, ["uid"]) },
          select: { id: true, uid: true, scope: true, status: true },
          take: perType,
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({ type: "shipment", id: r.id, uid: r.uid, title: r.scope, subtitle: r.status, href: `/shipments/${r.id}` }));
      },
    });
  }

  if (can("couriers")) {
    defs.push({
      type: "courier",
      labelKey: "couriers.title",
      run: async () => {
        const rows = await prisma.courier.findMany({
          where: { archivedAt: null, ...clause(parsed, ["name", "contact", "uid"]) },
          select: { id: true, uid: true, name: true, contact: true },
          take: perType,
          orderBy: { updatedAt: "desc" },
        });
        return rows.map((r) => ({ type: "courier", id: r.id, uid: r.uid, title: r.name, subtitle: r.contact, href: `/couriers/${r.id}` }));
      },
    });
  }

  if (can("logistics")) {
    defs.push({
      type: "carrier",
      labelKey: "carriers.title",
      run: async () => {
        const rows = await prisma.carrier.findMany({
          where: { archivedAt: null, ...clause(parsed, ["name", "contact", "uid"]) },
          select: { id: true, uid: true, name: true, contact: true },
          take: perType,
          orderBy: { updatedAt: "desc" },
        });
        return rows.map((r) => ({ type: "carrier", id: r.id, uid: r.uid, title: r.name, subtitle: r.contact, href: `/carriers/${r.id}` }));
      },
    });
  }

  if (can("issues")) {
    defs.push({
      type: "issue",
      labelKey: "issues.title",
      run: async () => {
        const rows = await prisma.issue.findMany({
          where: { ...clause(parsed, ["title", "uid", "note"]) },
          select: { id: true, uid: true, title: true, status: true },
          take: perType,
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({ type: "issue", id: r.id, uid: r.uid, title: r.title, subtitle: r.status, href: `/issues/${r.id}` }));
      },
    });
  }

  if (can("history")) {
    defs.push({
      type: "item",
      labelKey: "search.items",
      run: async () => {
        const where =
          parsed.kind === "uid"
            ? { uid: { startsWith: parsed.uid! } }
            : { OR: [{ uid: { contains: parsed.text } }, { product: { name: { contains: parsed.text } } }] };
        const rows = await prisma.item.findMany({
          where,
          select: { id: true, uid: true, product: { select: { name: true } } },
          take: perType,
          orderBy: { updatedAt: "desc" },
        });
        return rows.map((r) => ({ type: "item", id: r.id, uid: r.uid, title: r.product.name, subtitle: r.uid, href: `/history/items/${r.id}` }));
      },
    });
  }

  if (access.isAdmin && parsed.kind === "text") {
    defs.push({
      type: "user",
      labelKey: "users.users",
      run: async () => {
        const [locale, rows] = await Promise.all([
          getLocale(),
          prisma.user.findMany({
            where: { archivedAt: null, OR: [{ name: { contains: parsed.text } }, { nameAr: { contains: parsed.text } }, { email: { contains: parsed.text } }, { username: { contains: parsed.text } }] },
            select: { id: true, name: true, nameAr: true, email: true },
            take: perType,
            orderBy: { name: "asc" },
          }),
        ]);
        return rows.map((r) => ({ type: "user", id: r.id, uid: null, title: displayName(r, locale), subtitle: r.email, href: `/users/${r.id}` }));
      },
    });
  }

  // A UID query can only belong to one entity — run just that one.
  let toRun = defs;
  if (parsed.kind === "uid" && parsed.uid) {
    const t = UID_PREFIX_TYPE[uidPrefix(parsed.uid) ?? ""];
    if (t) toRun = defs.filter((d) => d.type === t);
  }

  const groups = await Promise.all(
    toRun.map(async (d) => {
      try {
        const hits = await d.run();
        return hits.length ? { type: d.type, labelKey: d.labelKey, hits } : null;
      } catch {
        return null;
      }
    }),
  );
  return groups.filter((g): g is SearchGroup => g !== null);
}
