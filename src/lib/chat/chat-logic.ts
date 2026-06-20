// Pure chat logic. No DB/IO. Unit-tested. See CHAT.md for the locked design.
// 1:1 conversations: deliveredAt/readAt on a message describe the RECIPIENT, so
// the sender renders ticks straight off the row.

/** A message sent within this many minutes of creation may still be edited. */
export const EDIT_WINDOW_MIN = 15;

/** Max characters in a single message body. */
export const MAX_BODY = 4000;

/** Tick shown next to a message the viewer SENT (recipients see nothing). */
export type TickState = "none" | "sent" | "delivered" | "read";

/** The subset of a ChatMessage the pure helpers need. */
export interface MsgLike {
  senderId: number;
  body: string;
  createdAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  editedAt: Date | null;
  unsentAt: Date | null;
  attachmentCount?: number;
}

/** The subset of a ChatConversation the pure helpers need. */
export interface ConvLike {
  userAId: number;
  userBId: number;
  lastMessageAt: Date;
}

/** Canonical pair ordering: userAId is always the lower id. Used so one unordered
 *  pair maps to exactly one conversation row. */
export function canonicalPair(a: number, b: number): { userAId: number; userBId: number } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

/** You cannot start a conversation with yourself. */
export function isSelfPair(a: number, b: number): boolean {
  return a === b;
}

/** The other participant of a 1:1 conversation, from the viewer's perspective. */
export function otherUserId(conv: { userAId: number; userBId: number }, viewerId: number): number {
  return conv.userAId === viewerId ? conv.userBId : conv.userAId;
}

/** Tick state for the SENDER's own message: none (retracted / not mine) · sent ·
 *  delivered (✓✓ gray) · read (✓✓ blue). */
export function tickState(msg: MsgLike, viewerId: number): TickState {
  if (msg.senderId !== viewerId) return "none";
  if (msg.unsentAt) return "none";
  if (msg.readAt) return "read";
  if (msg.deliveredAt) return "delivered";
  return "sent";
}

/** Sender may edit their own, non-retracted message within EDIT_WINDOW_MIN. */
export function canEditMessage(
  msg: Pick<MsgLike, "senderId" | "createdAt" | "unsentAt">,
  viewerId: number,
  now: Date,
  windowMin: number = EDIT_WINDOW_MIN,
): boolean {
  if (msg.senderId !== viewerId) return false;
  if (msg.unsentAt) return false;
  return now.getTime() - msg.createdAt.getTime() <= windowMin * 60_000;
}

/** Sender may unsend (retract for everyone) any of their own messages, no time
 *  limit, as long as it isn't already retracted. */
export function canUnsendMessage(
  msg: Pick<MsgLike, "senderId" | "unsentAt">,
  viewerId: number,
): boolean {
  return msg.senderId === viewerId && !msg.unsentAt;
}

/** A message counts as "edited" once it has an editedAt and isn't retracted. */
export function isEdited(msg: Pick<MsgLike, "editedAt" | "unsentAt">): boolean {
  return !!msg.editedAt && !msg.unsentAt;
}

/** Body to render: empty for a retracted message (the UI shows a tombstone). */
export function displayBody(msg: Pick<MsgLike, "body" | "unsentAt">): string {
  return msg.unsentAt ? "" : msg.body;
}

/** Structured preview for the conversation list. The UI maps `kind` to i18n
 *  ("message deleted" / "📷 Photo") and shows `text` for plain text. */
export function previewOf(
  msg: Pick<MsgLike, "body" | "unsentAt" | "attachmentCount">,
): { kind: "unsent" | "photo" | "text"; text: string } {
  if (msg.unsentAt) return { kind: "unsent", text: "" };
  const body = msg.body.trim();
  if (!body && (msg.attachmentCount ?? 0) > 0) return { kind: "photo", text: "" };
  return { kind: "text", text: msg.body };
}

/** Unread inbound messages for the viewer (not mine, not read, not retracted). */
export function unreadCount(messages: MsgLike[], viewerId: number): number {
  let n = 0;
  for (const m of messages) {
    if (m.senderId !== viewerId && !m.readAt && !m.unsentAt) n++;
  }
  return n;
}

/** Conversations most-recent-first (stable copy; does not mutate the input). */
export function sortConversations<T extends Pick<ConvLike, "lastMessageAt">>(list: T[]): T[] {
  return [...list].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
}

/** Validate a new/edited message. Returns an i18n error key on failure. */
export function validateMessageInput(input: { body?: string; attachmentCount?: number }):
  | { ok: true }
  | { ok: false; error: string } {
  const body = (input.body ?? "").trim();
  const n = input.attachmentCount ?? 0;
  if (!body && n === 0) return { ok: false, error: "chat.err.empty" };
  if (body.length > MAX_BODY) return { ok: false, error: "chat.err.tooLong" };
  return { ok: true };
}

/** Live event pushed over the SSE stream to a recipient's browser. Declared here
 *  (not in the server-only bus) so client components can import the type. */
export type ChatEvent =
  | { kind: "message"; conversationId: number; messageId: number; fromId: number }
  | { kind: "receipt"; conversationId: number; state: "delivered" | "read"; messageId?: number }
  | { kind: "edit"; conversationId: number; messageId: number }
  | { kind: "unsend"; conversationId: number; messageId: number }
  | { kind: "unread"; count: number }
  | { kind: "inquiry"; inquiryId: number };
