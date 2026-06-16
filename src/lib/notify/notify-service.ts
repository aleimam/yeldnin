import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { isAdminTier, type Tier } from "@/lib/auth/access-logic";
import type { PushPayload } from "./notify-logic";

// ── VAPID config (lazy: env may be absent in dev until keys are set) ─────────
let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@yeldn.local";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

/** Public key for the client to subscribe with (null if push isn't configured). */
export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/** Whether the server can actually send (both keys present). */
export function pushEnabled(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export interface ClientSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Store (or refresh) a device subscription. Endpoint is globally unique. */
export async function saveSubscription(userId: number, sub: ClientSubscription, ua?: string | null): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, ua: ua ?? undefined },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, ua: ua ?? null },
  });
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/** Fan a payload out to every device of the given users. Prunes dead endpoints.
 *  Never throws — push is best-effort and must not break the calling mutation. */
export async function sendToUsers(userIds: number[], payload: PushPayload): Promise<void> {
  if (!ensureConfigured() || userIds.length === 0) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  if (subs.length === 0) return;
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        // 404/410 = subscription expired/unsubscribed → drop it.
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
}

/** Active admin-tier users (the default audience for operational alerts). */
export async function adminUserIds(): Promise<number[]> {
  const users = await prisma.user.findMany({
    where: { active: true, archivedAt: null },
    select: { id: true, tier: true },
  });
  return users.filter((u) => isAdminTier(u.tier as Tier)).map((u) => u.id);
}

export async function notifyAdmins(payload: PushPayload): Promise<void> {
  await sendToUsers(await adminUserIds(), payload);
}
