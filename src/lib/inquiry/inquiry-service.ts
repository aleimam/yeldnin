import "server-only";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { sendCustomNotification } from "@/lib/notify/notify-message-service";
import { publish } from "@/lib/chat/bus";
import { validateInquiryText, shouldMarkAnswered } from "./inquiry-logic";

const USER_SELECT = { id: true, name: true, nameAr: true, avatarUrl: true } as const;

export interface InqUserLite {
  id: number;
  name: string;
  nameAr: string | null;
  avatarUrl: string | null;
}

// ─── team / participant helpers ───────────────────────────────────────────────

async function myTeamIds(userId: number): Promise<number[]> {
  const rows = await prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } });
  return rows.map((r) => r.teamId);
}
async function firstTeamId(userId: number): Promise<number | null> {
  const row = await prisma.teamMember.findFirst({
    where: { userId },
    select: { teamId: true },
    orderBy: { id: "asc" },
  });
  return row?.teamId ?? null;
}
async function teamMemberIds(teamId: number | null): Promise<number[]> {
  if (teamId == null) return [];
  const rows = await prisma.teamMember.findMany({ where: { teamId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

interface Sides {
  initiatorId: number;
  recipientUserId: number;
  initiatorTeamId: number | null;
  recipientTeamId: number | null;
}
async function isParticipant(userId: number, inq: Sides): Promise<boolean> {
  if (userId === inq.initiatorId || userId === inq.recipientUserId) return true;
  const teams = [inq.initiatorTeamId, inq.recipientTeamId].filter((t): t is number => t != null);
  if (!teams.length) return false;
  return !!(await prisma.teamMember.findFirst({ where: { userId, teamId: { in: teams } }, select: { id: true } }));
}
async function isInitiatorSide(userId: number, inq: Pick<Sides, "initiatorId" | "initiatorTeamId">): Promise<boolean> {
  if (userId === inq.initiatorId) return true;
  if (inq.initiatorTeamId == null) return false;
  return !!(await prisma.teamMember.findFirst({ where: { userId, teamId: inq.initiatorTeamId }, select: { id: true } }));
}

// ─── actors on a unit (the inquiry recipient pool) ────────────────────────────

/** Distinct users who acted on a unit during its history (from ItemEvent.byUserId),
 *  plus the item's creator for an ITEM. Excludes `excludeUserId` (the asker). */
export async function listUnitActors(
  unitKind: string,
  unitId: number,
  excludeUserId?: number,
): Promise<InqUserLite[]> {
  const ids = new Set<number>();
  if (unitKind === "ITEM") {
    const [events, item] = await Promise.all([
      prisma.itemEvent.findMany({ where: { itemId: unitId, byUserId: { not: null } }, select: { byUserId: true } }),
      prisma.item.findUnique({ where: { id: unitId }, select: { createdById: true } }),
    ]);
    for (const e of events) if (e.byUserId != null) ids.add(e.byUserId);
    if (item?.createdById != null) ids.add(item.createdById);
  } else {
    const events = await prisma.itemEvent.findMany({
      where: { containerType: unitKind, containerId: unitId, byUserId: { not: null } },
      select: { byUserId: true },
    });
    for (const e of events) if (e.byUserId != null) ids.add(e.byUserId);
  }
  if (excludeUserId != null) ids.delete(excludeUserId);
  if (!ids.size) return [];
  return prisma.user.findMany({
    where: { id: { in: [...ids] }, active: true, archivedAt: null },
    select: USER_SELECT,
    orderBy: { name: "asc" },
  });
}

// ─── notifications (inbox + push) + live chat-tab signal ──────────────────────

async function notifyInquiry(inquiryId: number, actorId: number, kind: "created" | "replied" | "closed"): Promise<void> {
  const inq = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true, uid: true, initiatorId: true, initiatorTeamId: true,
      recipientUserId: true, recipientTeamId: true,
    },
  });
  if (!inq) return;
  const [initTeam, recTeam, actor] = await Promise.all([
    teamMemberIds(inq.initiatorTeamId),
    teamMemberIds(inq.recipientTeamId),
    prisma.user.findUnique({ where: { id: actorId }, select: { name: true } }),
  ]);
  const audience = new Set<number>([inq.initiatorId, inq.recipientUserId, ...initTeam, ...recTeam]);
  audience.delete(actorId);
  const ids = [...audience];
  if (!ids.length) return;

  const who = actor?.name ?? "Someone";
  const title =
    kind === "created" ? `New inquiry from ${who}` : kind === "replied" ? `Inquiry reply from ${who}` : `Inquiry closed by ${who}`;
  await sendCustomNotification(
    { title, body: inq.uid ?? `Inquiry #${inq.id}`, link: `/inquiries/${inq.id}`, type: "info", target: { userIds: ids } },
    actorId,
  ).catch(() => {});
  for (const uid of ids) publish(uid, { kind: "inquiry", inquiryId: inq.id });
}

// ─── create / reply / close ───────────────────────────────────────────────────

export async function createInquiry(
  initiatorId: number,
  input: { unitKind: string; unitId: number; recipientUserId: number; body?: string; attachments?: { assetId: string }[] },
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const v = validateInquiryText({ body: input.body, attachmentCount: input.attachments?.length });
  if (!v.ok) return { ok: false, error: v.error };
  if (input.recipientUserId === initiatorId) return { ok: false, error: "inq.err.self" };

  const actors = await listUnitActors(input.unitKind, input.unitId);
  if (!actors.some((a) => a.id === input.recipientUserId)) return { ok: false, error: "inq.err.notActor" };

  const [initiatorTeamId, recipientTeamId, uid] = await Promise.all([
    firstTeamId(initiatorId),
    firstTeamId(input.recipientUserId),
    nextUid("INQ"),
  ]);

  const inq = await prisma.$transaction(async (tx) => {
    const created = await tx.inquiry.create({
      data: {
        uid, unitKind: input.unitKind, unitId: input.unitId,
        initiatorId, initiatorTeamId, recipientUserId: input.recipientUserId, recipientTeamId,
        status: "OPEN",
      },
    });
    await tx.inquiryMessage.create({
      data: {
        inquiryId: created.id, senderId: initiatorId, body: (input.body ?? "").trim(),
        attachments: input.attachments?.length ? { create: input.attachments.map((a) => ({ assetId: a.assetId })) } : undefined,
      },
    });
    return created;
  });

  await notifyInquiry(inq.id, initiatorId, "created");
  return { ok: true, id: inq.id };
}

export async function replyInquiry(
  userId: number,
  inquiryId: number,
  input: { body?: string; attachments?: { assetId: string }[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const inq = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, status: true, initiatorId: true, recipientUserId: true, initiatorTeamId: true, recipientTeamId: true },
  });
  if (!inq) return { ok: false, error: "inq.err.notFound" };
  if (!(await isParticipant(userId, inq))) return { ok: false, error: "inq.err.forbidden" };
  if (inq.status === "CLOSED") return { ok: false, error: "inq.err.closed" };
  const v = validateInquiryText({ body: input.body, attachmentCount: input.attachments?.length });
  if (!v.ok) return { ok: false, error: v.error };

  await prisma.$transaction(async (tx) => {
    await tx.inquiryMessage.create({
      data: {
        inquiryId, senderId: userId, body: (input.body ?? "").trim(),
        attachments: input.attachments?.length ? { create: input.attachments.map((a) => ({ assetId: a.assetId })) } : undefined,
      },
    });
    if (shouldMarkAnswered(inq, userId)) {
      await tx.inquiry.update({ where: { id: inquiryId }, data: { status: "ANSWERED", answeredAt: new Date() } });
    }
  });
  await notifyInquiry(inquiryId, userId, "replied");
  return { ok: true };
}

export async function closeInquiry(
  userId: number,
  inquiryId: number,
  dispositionId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const inq = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, status: true, initiatorId: true, initiatorTeamId: true },
  });
  if (!inq) return { ok: false, error: "inq.err.notFound" };
  if (inq.status === "CLOSED") return { ok: false, error: "inq.err.alreadyClosed" };
  if (!(await isInitiatorSide(userId, inq))) return { ok: false, error: "inq.err.notInitiatorSide" };
  const disp = await prisma.inquiryDisposition.findFirst({ where: { id: dispositionId, deletedAt: null }, select: { id: true } });
  if (!disp) return { ok: false, error: "inq.err.badDisposition" };

  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: "CLOSED", dispositionId, closedAt: new Date(), closedById: userId },
  });
  await notifyInquiry(inquiryId, userId, "closed");
  return { ok: true };
}

// ─── reads ────────────────────────────────────────────────────────────────────

export interface InquiryListRow {
  id: number;
  uid: string | null;
  unitKind: string;
  unitId: number;
  status: string;
  initiator: InqUserLite;
  recipient: InqUserLite;
  dispositionLabel: string | null;
  dispositionLabelAr: string | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

type ListRowSource = {
  id: number; uid: string | null; unitKind: string; unitId: number; status: string;
  initiator: InqUserLite; recipient: InqUserLite;
  disposition: { label: string; labelAr: string | null } | null;
  _count: { messages: number };
  createdAt: Date; updatedAt: Date;
};
function toListRow(r: ListRowSource): InquiryListRow {
  return {
    id: r.id, uid: r.uid, unitKind: r.unitKind, unitId: r.unitId, status: r.status,
    initiator: r.initiator, recipient: r.recipient,
    dispositionLabel: r.disposition?.label ?? null, dispositionLabelAr: r.disposition?.labelAr ?? null,
    messageCount: r._count.messages, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}
const LIST_INCLUDE = {
  initiator: { select: USER_SELECT },
  recipient: { select: USER_SELECT },
  disposition: { select: { label: true, labelAr: true } },
  _count: { select: { messages: true } },
} as const;

/** Inquiries I'm involved in (initiator, recipient, or on either team). */
export async function listMyInquiries(userId: number): Promise<InquiryListRow[]> {
  const teamIds = await myTeamIds(userId);
  const rows = await prisma.inquiry.findMany({
    where: {
      OR: [
        { initiatorId: userId },
        { recipientUserId: userId },
        { initiatorTeamId: { in: teamIds } },
        { recipientTeamId: { in: teamIds } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: LIST_INCLUDE,
  });
  return rows.map(toListRow);
}

/** Inquiries on a specific unit that the viewer may see (admin sees all). */
export async function listUnitInquiries(
  userId: number,
  unitKind: string,
  unitId: number,
  isAdmin = false,
): Promise<InquiryListRow[]> {
  const teamIds = isAdmin ? [] : await myTeamIds(userId);
  const rows = await prisma.inquiry.findMany({
    where: isAdmin
      ? { unitKind, unitId }
      : {
          unitKind,
          unitId,
          OR: [
            { initiatorId: userId },
            { recipientUserId: userId },
            { initiatorTeamId: { in: teamIds } },
            { recipientTeamId: { in: teamIds } },
          ],
        },
    orderBy: { updatedAt: "desc" },
    include: LIST_INCLUDE,
  });
  return rows.map(toListRow);
}

/** Admin: every inquiry, newest first. */
export async function listAllInquiries(take = 200): Promise<InquiryListRow[]> {
  const rows = await prisma.inquiry.findMany({ orderBy: { updatedAt: "desc" }, take, include: LIST_INCLUDE });
  return rows.map(toListRow);
}

export interface InquiryDetailMessage {
  id: number;
  senderId: number;
  sender: InqUserLite;
  body: string;
  createdAt: Date;
  attachments: { id: number; assetId: string }[];
}
export interface InquiryDetail {
  id: number;
  uid: string | null;
  unitKind: string;
  unitId: number;
  status: string;
  initiator: InqUserLite;
  recipient: InqUserLite;
  dispositionId: number | null;
  dispositionLabel: string | null;
  createdAt: Date;
  messages: InquiryDetailMessage[];
  canReply: boolean;
  canClose: boolean;
}

export async function getInquiry(userId: number, inquiryId: number, isAdmin = false): Promise<InquiryDetail | null> {
  const inq = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      initiator: { select: USER_SELECT },
      recipient: { select: USER_SELECT },
      disposition: { select: { id: true, label: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: USER_SELECT }, attachments: { select: { id: true, assetId: true } } },
      },
    },
  });
  if (!inq) return null;
  const participant = isAdmin || (await isParticipant(userId, inq));
  if (!participant) return null;
  const initiatorSide = inq.status !== "CLOSED" ? await isInitiatorSide(userId, inq) : false;

  return {
    id: inq.id, uid: inq.uid, unitKind: inq.unitKind, unitId: inq.unitId, status: inq.status,
    initiator: inq.initiator, recipient: inq.recipient,
    dispositionId: inq.dispositionId, dispositionLabel: inq.disposition?.label ?? null,
    createdAt: inq.createdAt,
    messages: inq.messages.map((m) => ({
      id: m.id, senderId: m.senderId, sender: m.sender, body: m.body, createdAt: m.createdAt, attachments: m.attachments,
    })),
    canReply: inq.status !== "CLOSED" && participant,
    canClose: initiatorSide,
  };
}

// ─── dispositions (admin catalog) ─────────────────────────────────────────────

export async function listDispositions(): Promise<{ id: number; key: string; label: string; labelAr: string | null; sortOrder: number }[]> {
  return prisma.inquiryDisposition.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, key: true, label: true, labelAr: true, sortOrder: true },
  });
}

// ─── analytics (admin) ────────────────────────────────────────────────────────

export interface InquiryAnalytics {
  total: number;
  byStatus: { OPEN: number; ANSWERED: number; CLOSED: number };
  byDisposition: { label: string; count: number }[];
  avgAnswerHours: number | null;
}
export async function inquiryAnalytics(): Promise<InquiryAnalytics> {
  const all = await prisma.inquiry.findMany({
    select: { status: true, createdAt: true, answeredAt: true, disposition: { select: { label: true } } },
  });
  const byStatus = { OPEN: 0, ANSWERED: 0, CLOSED: 0 };
  const disp = new Map<string, number>();
  let answered = 0;
  let sumMs = 0;
  for (const i of all) {
    if (i.status in byStatus) byStatus[i.status as keyof typeof byStatus]++;
    if (i.disposition) disp.set(i.disposition.label, (disp.get(i.disposition.label) ?? 0) + 1);
    if (i.answeredAt) {
      answered++;
      sumMs += i.answeredAt.getTime() - i.createdAt.getTime();
    }
  }
  return {
    total: all.length,
    byStatus,
    byDisposition: [...disp.entries()].map(([label, count]) => ({ label, count })),
    avgAnswerHours: answered ? sumMs / answered / 3_600_000 : null,
  };
}
