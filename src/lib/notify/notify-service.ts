import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { isAdminTier, type Tier, type Level } from "@/lib/auth/access-logic";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { isModuleOperator, unitUpdatePayload, splitCsv, type PushPayload } from "./notify-logic";
import { getNotifyRules } from "./notify-config-service";

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

/** Active users who should hear about a module event: admins + anyone with
 *  >= `min` (default OPERATE) on one of `moduleKeys`. */
export async function moduleOperatorIds(moduleKeys: string[], min: Level = "OPERATE"): Promise<number[]> {
  const users = await prisma.user.findMany({
    where: { active: true, archivedAt: null },
    select: {
      id: true,
      tier: true,
      modulePerms: { where: { moduleKey: { in: moduleKeys } }, select: { moduleKey: true, level: true } },
    },
  });
  return users
    .filter((u) =>
      isModuleOperator(
        u.tier as Tier,
        u.modulePerms.map((p) => ({ moduleKey: p.moduleKey, level: p.level as Level })),
        moduleKeys,
        min,
      ),
    )
    .map((u) => u.id);
}

export async function notifyModuleOperators(moduleKeys: string[], payload: PushPayload): Promise<void> {
  await sendToUsers(await moduleOperatorIds(moduleKeys), payload);
}

/**
 * Notify the creator of each affected order that its units reached a new
 * milestone. De-duped per (order, status); skips the actor so people aren't
 * pinged for their own actions. Best-effort — never throws.
 */
/**
 * Resolve recipient user-ids for an event from the admin matrix. Recipients =
 * admins (if notifyAdmins) + operators of the configured modules (or
 * ctx.fallbackModules when none are set) + the order creator (if
 * notifyOrderCreator and ctx provides one). Empty when the event is disabled.
 */
export async function resolveRecipients(
  event: string,
  ctx?: { orderCreatorId?: number | null; fallbackModules?: string[] },
): Promise<number[]> {
  const rule = (await getNotifyRules())[event];
  if (!rule || !rule.enabled) return [];
  const ids = new Set<number>();
  if (rule.notifyAdmins) for (const id of await adminUserIds()) ids.add(id);
  const mods = splitCsv(rule.moduleKeys);
  const useMods = mods.length ? mods : ctx?.fallbackModules ?? [];
  if (useMods.length) for (const id of await moduleOperatorIds(useMods)) ids.add(id);
  if (rule.notifyOrderCreator && ctx?.orderCreatorId) ids.add(ctx.orderCreatorId);
  return [...ids];
}

/**
 * Notify recipients of the unit.milestone event when orders' units reach a
 * status the matrix marks notable. De-duped per (order, status); skips the
 * actor so people aren't pinged for their own actions. Best-effort.
 */
export async function notifyUnitMilestones(
  transitions: { requestId: number; toStatus: string }[],
  actorId: number,
): Promise<void> {
  if (transitions.length === 0) return;
  const rule = (await getNotifyRules())["unit.milestone"];
  if (!rule?.enabled) return;
  const notable = new Set(splitCsv(rule.statuses));
  const relevant = transitions.filter((t) => notable.has(t.toStatus));
  if (relevant.length === 0) return;

  const base = await resolveRecipients("unit.milestone"); // admins + module ops; creator added per order
  const ids = [...new Set(relevant.map((t) => t.requestId))];
  const [requests, wf] = await Promise.all([
    prisma.request.findMany({ where: { id: { in: ids } }, select: { id: true, uid: true, createdById: true } }),
    getWorkflow(),
  ]);
  const byId = new Map(requests.map((r) => [r.id, r]));
  const seen = new Set<string>();
  for (const tr of relevant) {
    const key = `${tr.requestId}:${tr.toStatus}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = byId.get(tr.requestId);
    if (!r) continue;
    const recipients = new Set(base);
    if (rule.notifyOrderCreator && r.createdById) recipients.add(r.createdById);
    const final = [...recipients].filter((id) => id !== actorId);
    if (final.length === 0) continue;
    await sendToUsers(
      final,
      unitUpdatePayload({ uid: r.uid, statusLabel: wf.label(tr.toStatus as ItemStatus, "en"), requestId: r.id }),
    ).catch(() => {});
  }
}
