import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { isAdminTier, type Tier, type Level } from "@/lib/auth/access-logic";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { isModuleOperator, unitUpdatePayload, splitCsv, modulesForScope, type PushPayload } from "./notify-logic";
import { getNotifyRules } from "./notify-config-service";
import { makeT, isLocale, type Locale, type TFunction } from "@/i18n";

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

/** Like sendToUsers, but renders the payload per recipient locale (grouped by
 *  User.locale) so each device shows the notification in the user's language. */
export async function sendLocalizedToUsers(
  userIds: number[],
  build: (t: TFunction, locale: Locale) => PushPayload,
): Promise<void> {
  if (!ensureConfigured() || userIds.length === 0) return;
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, locale: true } });
  const byLocale = new Map<Locale, number[]>();
  for (const u of users) {
    const loc: Locale = isLocale(u.locale) ? u.locale : "en";
    const arr = byLocale.get(loc);
    if (arr) arr.push(u.id);
    else byLocale.set(loc, [u.id]);
  }
  for (const [loc, ids] of byLocale) {
    await sendToUsers(ids, build(makeT(loc), loc));
  }
}

/** Active admin-tier users (the default audience for operational alerts). */
export async function adminUserIds(): Promise<number[]> {
  const users = await prisma.user.findMany({
    where: { active: true, archivedAt: null },
    select: { id: true, tier: true },
  });
  return users.filter((u) => isAdminTier(u.tier as Tier)).map((u) => u.id);
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

/**
 * Resolve recipient user-ids for an event from the admin matrix. Recipients =
 * admins (if notifyAdmins) + operators of the configured modules (or
 * ctx.fallbackModules when none are set) + the order creator (if
 * notifyOrderCreator and ctx provides one). Empty when the event is disabled.
 *
 * When the event concerns a scoped record, pass ctx.scope: scope-bound modules
 * that don't match are dropped, so a scoped notification can never reach the
 * other business line's operators — the golden rule holds even if an admin
 * configured the rule with both `order_requests` and `xoonx`.
 */
export async function resolveRecipients(
  event: string,
  ctx?: { orderCreatorId?: number | null; fallbackModules?: string[]; scope?: string | null },
): Promise<number[]> {
  const rule = (await getNotifyRules())[event];
  if (!rule || !rule.enabled) return [];
  const ids = new Set<number>();
  if (rule.notifyAdmins) for (const id of await adminUserIds()) ids.add(id);
  const mods = splitCsv(rule.moduleKeys);
  const useMods = modulesForScope(mods.length ? mods : ctx?.fallbackModules ?? [], ctx?.scope);
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

  const ids = [...new Set(relevant.map((t) => t.requestId))];
  const [requests, wf] = await Promise.all([
    prisma.request.findMany({ where: { id: { in: ids } }, select: { id: true, uid: true, createdById: true, scope: true } }),
    getWorkflow(),
  ]);
  const byId = new Map(requests.map((r) => [r.id, r]));
  // Module-operator recipients are scope-bound (golden rule), so resolve the base
  // set once per distinct scope and reuse it; the order creator is added per order.
  const baseByScope = new Map<string, number[]>();
  const baseFor = async (scope: string): Promise<number[]> => {
    let b = baseByScope.get(scope);
    if (!b) { b = await resolveRecipients("unit.milestone", { scope }); baseByScope.set(scope, b); }
    return b;
  };
  const seen = new Set<string>();
  for (const tr of relevant) {
    const key = `${tr.requestId}:${tr.toStatus}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = byId.get(tr.requestId);
    if (!r) continue;
    const recipients = new Set(await baseFor(r.scope));
    if (rule.notifyOrderCreator && r.createdById) recipients.add(r.createdById);
    const final = [...recipients].filter((id) => id !== actorId);
    if (final.length === 0) continue;
    await sendLocalizedToUsers(final, (t, locale) =>
      unitUpdatePayload(t, { uid: r.uid, statusLabel: wf.label(tr.toStatus as ItemStatus, locale), requestId: r.id }),
    ).catch(() => {});
  }
}
