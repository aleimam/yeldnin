import "server-only";
import { prisma } from "@/lib/db";
import { sendToUsers } from "./notify-service";

export const NOTIFICATION_TYPES = ["info", "warning", "success"] as const;

export interface ComposeInput {
  title: string;
  body: string;
  link?: string | null;
  imageAssetId?: string | null;
  type?: string; // info | warning | success
  target: { all?: boolean; userIds?: number[]; teamKeys?: string[] };
}

/** Resolve a target spec into a deduped list of active, non-archived user ids. */
export async function resolveTargetUserIds(target: ComposeInput["target"]): Promise<number[]> {
  if (target.all) {
    const users = await prisma.user.findMany({ where: { active: true, archivedAt: null }, select: { id: true } });
    return users.map((u) => u.id);
  }
  const ids = new Set<number>(target.userIds ?? []);
  if (target.teamKeys?.length) {
    const members = await prisma.teamMember.findMany({
      where: { team: { key: { in: target.teamKeys } } },
      select: { userId: true },
    });
    for (const m of members) ids.add(m.userId);
  }
  if (!ids.size) return [];
  const active = await prisma.user.findMany({
    where: { id: { in: [...ids] }, active: true, archivedAt: null },
    select: { id: true },
  });
  return active.map((u) => u.id);
}

/**
 * Persist a custom notification + a recipient row per resolved user (the in-app
 * inbox), then best-effort web-push to their subscribed devices. Returns the
 * recipient count. Throws if no recipients match.
 */
export async function sendCustomNotification(input: ComposeInput, senderId: number): Promise<number> {
  const recipientIds = await resolveTargetUserIds(input.target);
  if (!recipientIds.length) throw new Error("No recipients matched the selection.");
  const type = (NOTIFICATION_TYPES as readonly string[]).includes(input.type ?? "") ? input.type! : "info";
  const title = input.title.trim();
  const body = input.body.trim();
  const link = input.link?.trim() || null;

  const message = await prisma.notificationMessage.create({
    data: {
      title,
      body,
      link,
      imageAssetId: input.imageAssetId || null,
      type,
      senderId,
      recipients: { create: recipientIds.map((userId) => ({ userId })) },
    },
  });

  // In-app inbox is already saved; push is a best-effort bonus for subscribers.
  await sendToUsers(recipientIds, { title, body, url: link || "/notifications", tag: `custom-${message.id}` }).catch(() => {});
  return recipientIds.length;
}

export interface InboxRow {
  id: number; // recipient row id
  title: string;
  body: string;
  link: string | null;
  imageAssetId: string | null;
  type: string;
  createdAt: Date;
  readAt: Date | null;
}

/** A user's inbox, newest first. */
export async function listInbox(userId: number, take = 100): Promise<InboxRow[]> {
  const rows = await prisma.notificationRecipient.findMany({
    where: { userId },
    orderBy: { id: "desc" },
    take,
    include: { message: true },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.message.title,
    body: r.message.body,
    link: r.message.link,
    imageAssetId: r.message.imageAssetId,
    type: r.message.type,
    createdAt: r.message.createdAt,
    readAt: r.readAt,
  }));
}

export function unreadCount(userId: number): Promise<number> {
  return prisma.notificationRecipient.count({ where: { userId, readAt: null } });
}

export async function markRead(recipientId: number, userId: number): Promise<void> {
  await prisma.notificationRecipient.updateMany({ where: { id: recipientId, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: number): Promise<void> {
  await prisma.notificationRecipient.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
