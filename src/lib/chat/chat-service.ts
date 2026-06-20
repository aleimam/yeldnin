import "server-only";
import { prisma } from "@/lib/db";
import { publish } from "./bus";
import { canonicalPair, validateMessageInput, canEditMessage, canUnsendMessage } from "./chat-logic";

const USER_SELECT = { id: true, name: true, nameAr: true, avatarUrl: true } as const;

export interface ChatUserLite {
  id: number;
  name: string;
  nameAr: string | null;
  avatarUrl: string | null;
}

function isMember(conv: { userAId: number; userBId: number }, me: number): boolean {
  return conv.userAId === me || conv.userBId === me;
}
function otherOf(conv: { userAId: number; userBId: number }, me: number): number {
  return conv.userAId === me ? conv.userBId : conv.userAId;
}

/** One conversation per unordered pair; create it on first contact. */
export async function getOrCreateConversation(me: number, other: number) {
  if (me === other) throw new Error("cannot chat with yourself");
  const pair = canonicalPair(me, other);
  return prisma.chatConversation.upsert({
    where: { userAId_userBId: { userAId: pair.userAId, userBId: pair.userBId } },
    create: { userAId: pair.userAId, userBId: pair.userBId },
    update: {},
  });
}

export interface ConversationRow {
  id: number;
  other: ChatUserLite;
  lastBody: string;
  lastAt: Date;
  lastFromMe: boolean;
  lastUnsent: boolean;
  lastHasPhoto: boolean;
  unread: number;
}

/** All my conversations, most-recent-first, with the other party, a last-message
 *  preview and my unread count per conversation. */
export async function listConversations(me: number): Promise<ConversationRow[]> {
  const convs = await prisma.chatConversation.findMany({
    where: { OR: [{ userAId: me }, { userBId: me }] },
    orderBy: { lastMessageAt: "desc" },
    include: {
      userA: { select: USER_SELECT },
      userB: { select: USER_SELECT },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { attachments: true } } },
      },
    },
  });
  const ids = convs.map((c) => c.id);
  const unreadRows = ids.length
    ? await prisma.chatMessage.findMany({
        where: { conversationId: { in: ids }, senderId: { not: me }, readAt: null, unsentAt: null },
        select: { conversationId: true },
      })
    : [];
  const unreadByConv = new Map<number, number>();
  for (const r of unreadRows) unreadByConv.set(r.conversationId, (unreadByConv.get(r.conversationId) ?? 0) + 1);

  return convs.map((c) => {
    const other = c.userAId === me ? c.userB : c.userA;
    const last = c.messages[0];
    return {
      id: c.id,
      other,
      lastBody: last && !last.unsentAt ? last.body : "",
      lastAt: c.lastMessageAt,
      lastFromMe: last ? last.senderId === me : false,
      lastUnsent: last ? !!last.unsentAt : false,
      lastHasPhoto: last ? last._count.attachments > 0 : false,
      unread: unreadByConv.get(c.id) ?? 0,
    };
  });
}

export interface MessageRow {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  unsentAt: Date | null;
  replyToId: number | null;
  replyToBody: string | null;
  replyToSenderId: number | null;
  attachments: { id: number; assetId: string; width: number | null; height: number | null }[];
}

function toRow(m: {
  id: number; conversationId: number; senderId: number; body: string; createdAt: Date;
  editedAt: Date | null; deliveredAt: Date | null; readAt: Date | null; unsentAt: Date | null;
  replyToId: number | null;
  replyTo: { body: string; senderId: number; unsentAt: Date | null } | null;
  attachments: { id: number; assetId: string; width: number | null; height: number | null }[];
}): MessageRow {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    body: m.unsentAt ? "" : m.body,
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    deliveredAt: m.deliveredAt,
    readAt: m.readAt,
    unsentAt: m.unsentAt,
    replyToId: m.replyToId,
    replyToBody: m.replyTo ? (m.replyTo.unsentAt ? "" : m.replyTo.body) : null,
    replyToSenderId: m.replyTo?.senderId ?? null,
    attachments: m.unsentAt ? [] : m.attachments,
  };
}

const MSG_INCLUDE = {
  attachments: { select: { id: true, assetId: true, width: true, height: true } },
  replyTo: { select: { body: true, senderId: true, unsentAt: true } },
} as const;

/** Messages in a conversation I belong to, oldest-first. */
export async function listMessages(me: number, conversationId: number, take = 100): Promise<MessageRow[]> {
  const conv = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { userAId: true, userBId: true },
  });
  if (!conv || !isMember(conv, me)) throw new Error("Forbidden");
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take,
    include: MSG_INCLUDE,
  });
  return rows.reverse().map(toRow);
}

export interface SendInput {
  conversationId?: number;
  toUserId?: number;
  body?: string;
  replyToId?: number;
  attachments?: { assetId: string; width?: number; height?: number }[];
}

export async function sendMessage(
  me: number,
  input: SendInput,
): Promise<{ ok: true; message: MessageRow } | { ok: false; error: string }> {
  const v = validateMessageInput({ body: input.body, attachmentCount: input.attachments?.length });
  if (!v.ok) return { ok: false, error: v.error };

  let conversationId = input.conversationId;
  let conv: { userAId: number; userBId: number } | null = null;
  if (conversationId) {
    conv = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { userAId: true, userBId: true },
    });
    if (!conv || !isMember(conv, me)) return { ok: false, error: "chat.err.forbidden" };
  } else if (input.toUserId != null) {
    if (input.toUserId === me) return { ok: false, error: "chat.err.self" };
    const c = await getOrCreateConversation(me, input.toUserId);
    conversationId = c.id;
    conv = { userAId: c.userAId, userBId: c.userBId };
  } else {
    return { ok: false, error: "chat.err.noTarget" };
  }

  // A reply target must live in the same conversation.
  let replyToId: number | null = null;
  if (input.replyToId != null) {
    const r = await prisma.chatMessage.findUnique({
      where: { id: input.replyToId },
      select: { conversationId: true },
    });
    if (r && r.conversationId === conversationId) replyToId = input.replyToId;
  }

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const m = await tx.chatMessage.create({
      data: {
        conversationId: conversationId!,
        senderId: me,
        body: (input.body ?? "").trim(),
        replyToId,
        attachments: input.attachments?.length
          ? { create: input.attachments.map((a) => ({ assetId: a.assetId, width: a.width ?? null, height: a.height ?? null })) }
          : undefined,
      },
      include: MSG_INCLUDE,
    });
    await tx.chatConversation.update({ where: { id: conversationId! }, data: { lastMessageAt: now } });
    return m;
  });

  const recipient = otherOf(conv!, me);
  publish(recipient, { kind: "message", conversationId: conversationId!, messageId: created.id, fromId: me });
  publish(me, { kind: "message", conversationId: conversationId!, messageId: created.id, fromId: me });
  publish(recipient, { kind: "unread", count: await totalUnread(recipient) });

  return { ok: true, message: toRow(created) };
}

export async function editMessage(
  me: number,
  messageId: number,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: {
      senderId: true, createdAt: true, unsentAt: true, conversationId: true,
      conversation: { select: { userAId: true, userBId: true } },
      _count: { select: { attachments: true } },
    },
  });
  if (!m) return { ok: false, error: "chat.err.notFound" };
  if (!canEditMessage(m, me, new Date())) return { ok: false, error: "chat.err.editWindow" };
  const v = validateMessageInput({ body, attachmentCount: m._count.attachments });
  if (!v.ok) return { ok: false, error: v.error };
  await prisma.chatMessage.update({ where: { id: messageId }, data: { body: body.trim(), editedAt: new Date() } });
  const other = otherOf(m.conversation, me);
  publish(other, { kind: "edit", conversationId: m.conversationId, messageId });
  publish(me, { kind: "edit", conversationId: m.conversationId, messageId });
  return { ok: true };
}

export async function unsendMessage(
  me: number,
  messageId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: {
      senderId: true, unsentAt: true, conversationId: true,
      conversation: { select: { userAId: true, userBId: true } },
    },
  });
  if (!m) return { ok: false, error: "chat.err.notFound" };
  if (!canUnsendMessage(m, me)) return { ok: false, error: "chat.err.cannotUnsend" };
  await prisma.$transaction(async (tx) => {
    await tx.chatAttachment.deleteMany({ where: { messageId } });
    await tx.chatMessage.update({ where: { id: messageId }, data: { unsentAt: new Date(), body: "" } });
  });
  const other = otherOf(m.conversation, me);
  publish(other, { kind: "unsend", conversationId: m.conversationId, messageId });
  publish(me, { kind: "unsend", conversationId: m.conversationId, messageId });
  return { ok: true };
}

/** Mark every inbound, not-yet-delivered message to me as delivered, and tell each
 *  sender. Called when a user opens a live stream. */
export async function markAllDelivered(me: number): Promise<void> {
  const pending = await prisma.chatMessage.findMany({
    where: { senderId: { not: me }, deliveredAt: null, unsentAt: null, conversation: { OR: [{ userAId: me }, { userBId: me }] } },
    select: { id: true, senderId: true, conversationId: true },
  });
  if (!pending.length) return;
  await prisma.chatMessage.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { deliveredAt: new Date() },
  });
  for (const p of pending) {
    publish(p.senderId, { kind: "receipt", conversationId: p.conversationId, state: "delivered", messageId: p.id });
  }
}

/** Mark inbound messages in a conversation as read; notify the sender; return my
 *  new total unread. */
export async function markRead(me: number, conversationId: number): Promise<number> {
  const conv = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { userAId: true, userBId: true },
  });
  if (!conv || !isMember(conv, me)) throw new Error("Forbidden");
  const now = new Date();
  const res = await prisma.chatMessage.updateMany({
    where: { conversationId, senderId: { not: me }, readAt: null },
    data: { readAt: now, deliveredAt: now },
  });
  if (res.count > 0) publish(otherOf(conv, me), { kind: "receipt", conversationId, state: "read" });
  const total = await totalUnread(me);
  publish(me, { kind: "unread", count: total });
  return total;
}

export async function totalUnread(me: number): Promise<number> {
  return prisma.chatMessage.count({
    where: { senderId: { not: me }, readAt: null, unsentAt: null, conversation: { OR: [{ userAId: me }, { userBId: me }] } },
  });
}

export interface ChatablePerson extends ChatUserLite {
  recent: boolean;
}

/** Everyone I could start a chat with (active users, minus me), recently-chatted
 *  first then alphabetical. */
export async function listChatablePeople(me: number): Promise<ChatablePerson[]> {
  const [convs, users] = await Promise.all([
    prisma.chatConversation.findMany({
      where: { OR: [{ userAId: me }, { userBId: me }] },
      select: { userAId: true, userBId: true },
    }),
    prisma.user.findMany({
      where: { active: true, archivedAt: null, id: { not: me } },
      select: USER_SELECT,
      orderBy: { name: "asc" },
    }),
  ]);
  const recentIds = new Set<number>();
  for (const c of convs) recentIds.add(otherOf(c, me));
  return users
    .map((u) => ({ ...u, recent: recentIds.has(u.id) }))
    .sort((a, b) => (a.recent === b.recent ? a.name.localeCompare(b.name) : a.recent ? -1 : 1));
}
