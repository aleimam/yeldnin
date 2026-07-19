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

  let existing = await prisma.customer.findUnique({ where: { veeeyCustomerId: w.veeeyCustomerId }, select: { id: true, scope: true } });
  if (!existing) {
    // First-link adoption: an existing scope-VEEEY customer with the exact name.
    const byName = await prisma.customer.findFirst({ where: { name: w.name, scope: "VEEEY", veeeyCustomerId: null }, select: { id: true, scope: true } });
    if (byName) existing = byName;
  }

  // Guard: never touch a non-VEEEY (e.g. XOONX) customer via the sync.
  if (existing && existing.scope !== "VEEEY") return { ok: false, skipped: "customer_scope_mismatch" };

  const data = {
    veeeyCustomerId: w.veeeyCustomerId,
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
