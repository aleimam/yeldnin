import "server-only";
import { prisma } from "@/lib/db";
import { clean } from "@/lib/text";
import { nextUid } from "@/lib/uid";
import { hashPassword } from "@/lib/auth/password";
import { normalizePhone, courierEmail } from "@/lib/couriers/courier-login-logic";

export interface CourierInput {
  name: string;
  contact?: string | null;
}

export function listCouriers() {
  return prisma.courier.findMany({ where: { archivedAt: null }, orderBy: { createdAt: "desc" }, take: 200 });
}
/** Paginated + searchable couriers (name / uid / contact). */
export async function listCouriersPaged(opts: { search?: string; skip?: number; take?: number }) {
  const where = { archivedAt: null, ...(opts.search ? { OR: [{ name: { contains: opts.search } }, { uid: { contains: opts.search } }, { contact: { contains: opts.search } }] } : {}) };
  const [rows, total] = await prisma.$transaction([
    prisma.courier.findMany({ where, orderBy: { createdAt: "desc" }, skip: opts.skip ?? 0, take: opts.take ?? 50 }),
    prisma.courier.count({ where }),
  ]);
  return { rows, total };
}
export function getCourier(id: number) {
  return prisma.courier.findFirst({ where: { id, archivedAt: null } });
}
/** Courier + the login account it's linked to (if any), for the detail page. */
export function getCourierWithLogin(id: number) {
  return prisma.courier.findFirst({
    where: { id, archivedAt: null },
    include: { user: { select: { id: true, username: true, active: true, tier: true, lockedUntil: true } } },
  });
}
/** Active couriers for a picker (e.g. the Patch form). */
export function listCouriersForPicker() {
  return prisma.courier.findMany({
    where: { archivedAt: null, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
export async function createCourier(input: CourierInput, userId: number) {
  const uid = await nextUid("CUR");
  return prisma.courier.create({ data: { uid, name: input.name.trim(), contact: clean(input.contact), createdById: userId } });
}
export async function updateCourier(id: number, input: CourierInput & { active: boolean }, userId: number) {
  return prisma.courier.update({
    where: { id },
    data: { name: input.name.trim(), contact: clean(input.contact), active: input.active, updatedById: userId },
  });
}
export async function archiveCourier(id: number) {
  return prisma.courier.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
}

// ── Courier login accounts (phone + PIN) ─────────────────────────────────────
// A courier login is a THIRD_PARTY User carrying EXACTLY ONE permission
// (couriers OPERATE). The tier and the permission are hardcoded here and never
// taken from a caller — so "manage the courier roster" can never be leveraged
// into minting a general-privilege account. See INTEGRATION_V2_DELIVERIES.md §5.

export type LoginResult = { ok: true } | { ok: false; error: string };

/** Create the phone+PIN login for a courier that doesn't have one yet.
 *  `pin` must already be policy-checked by the caller; it is hashed here. */
export async function createCourierLogin(courierId: number, rawPhone: string, pin: string, actorId: number): Promise<LoginResult> {
  const courier = await prisma.courier.findFirst({ where: { id: courierId, archivedAt: null }, select: { id: true, name: true, userId: true } });
  if (!courier) return { ok: false, error: "Courier not found." };
  if (courier.userId) return { ok: false, error: "This courier already has a login." };

  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "Enter a valid Egyptian mobile number." };

  // The phone is the login handle (User.username), which must be unique. A synthetic
  // email keeps the phone out of the email column but must not collide either.
  const email = courierEmail(phone);
  const clash = await prisma.user.findFirst({ where: { OR: [{ username: phone }, { email }] }, select: { id: true } });
  if (clash) return { ok: false, error: "That phone number is already in use." };

  const passwordHash = await hashPassword(pin);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: courier.name,
        username: phone,
        email,
        tier: "THIRD_PARTY", // hardcoded — never from the caller
        passwordHash,
        primaryPhone: phone,
      },
    });
    // Exactly one permission. A courier never lands on a dashboard of modules it
    // can't open (§5.1); everything else stays NONE by absence.
    await tx.userModulePermission.create({ data: { userId: user.id, moduleKey: "couriers", level: "OPERATE" } });
    await tx.courier.update({ where: { id: courierId }, data: { userId: user.id, active: true, updatedById: actorId } });
  });
  return { ok: true };
}

/** Reset a courier's PIN. Bumps tokenVersion so any active session is revoked. */
export async function resetCourierPin(courierId: number, pin: string, actorId: number): Promise<LoginResult> {
  const courier = await prisma.courier.findFirst({ where: { id: courierId, archivedAt: null }, select: { userId: true } });
  if (!courier?.userId) return { ok: false, error: "This courier has no login." };
  const passwordHash = await hashPassword(pin);
  await prisma.user.update({
    where: { id: courier.userId },
    // tokenVersion++ logs the courier out everywhere; clear any lockout so the new PIN works at once.
    data: { passwordHash, tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null, updatedAt: new Date() },
  });
  void actorId;
  return { ok: true };
}

/** Enable or disable a courier's login without deleting it. Disabling revokes
 *  the current session (tokenVersion bump) and blocks sign-in (active:false). */
export async function setCourierLoginActive(courierId: number, active: boolean, actorId: number): Promise<LoginResult> {
  const courier = await prisma.courier.findFirst({ where: { id: courierId, archivedAt: null }, select: { userId: true } });
  if (!courier?.userId) return { ok: false, error: "This courier has no login." };
  await prisma.user.update({
    where: { id: courier.userId },
    data: active ? { active: true } : { active: false, tokenVersion: { increment: 1 } },
  });
  void actorId;
  return { ok: true };
}
