import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { parseWireCustomer } from "@/lib/integration/customer-wire";

/**
 * Customer-upsert DB glue for the NEW Veeey (contract v2 §2). Writes DIRECTLY,
 * inbound only. Veeey masters registered customers' identity + name + phone;
 * YeldnIN stamps scope VEEEY and the VEEEY contact channel, and owns internal
 * notes (never touched here). Matches on veeeyCustomerId, else adopts a
 * same-name VEEEY customer once, else creates.
 */
const VEEEY_CHANNEL = "VEEEY";

export interface CustomerUpsertResult {
  ok: boolean;
  customerId?: number;
  created?: boolean;
  skipped?: string;
}

export async function handleCustomerUpsert(payload: unknown): Promise<CustomerUpsertResult> {
  const w = parseWireCustomer(payload);
  if (!w) return { ok: false, skipped: "validation_failed" };

  // Match order (contract v2, cross-store):
  //  1. by EMAIL — the durable identity shared by the SAME person across the two
  //     Veeey stores. This is FIRST so a veeey.net push reconciles onto the
  //     existing (veeey.com-sourced) customer instead of creating a duplicate.
  //  2. by veeeyCustomerId — the per-store account id (works within one store).
  //  3. by exact name where no id is set — legacy first-link adoption.
  let existing =
    (w.email
      ? await prisma.customer.findFirst({ where: { email: w.email, scope: "VEEEY" }, select: { id: true, scope: true } })
      : null) ??
    (await prisma.customer.findUnique({ where: { veeeyCustomerId: w.veeeyCustomerId }, select: { id: true, scope: true } }));
  if (!existing) {
    const byName = await prisma.customer.findFirst({ where: { name: w.name, scope: "VEEEY", veeeyCustomerId: null }, select: { id: true, scope: true } });
    if (byName) existing = byName;
  }

  // Guard: never touch a non-VEEEY (e.g. XOONX) customer via the sync.
  if (existing && existing.scope !== "VEEEY") return { ok: false, skipped: "customer_scope_mismatch" };

  // On match we RE-KEY veeeyCustomerId to the inbound id: veeey.net is the main
  // store now, so it becomes the identity owner (owner-approved). Email is stored
  // so future matches are cheap.
  const data = {
    veeeyCustomerId: w.veeeyCustomerId,
    email: w.email,
    name: w.name,
    contactNumber: w.phone,
    ...(w.archived ? { archivedAt: new Date(), active: false } : {}),
  };

  if (existing) {
    await prisma.customer.update({ where: { id: existing.id }, data });
    return { ok: true, customerId: existing.id, created: false };
  }

  const uid = await nextUid("CUS");
  const created = await prisma.customer.create({
    data: { uid, scope: "VEEEY", contactChannel: VEEEY_CHANNEL, ...data },
    select: { id: true },
  });
  return { ok: true, customerId: created.id, created: true };
}
