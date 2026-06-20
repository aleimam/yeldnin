"use server";
import { getAccess } from "@/lib/auth/access";
import * as chat from "@/lib/chat/chat-service";

// Chat is universal — any authenticated user may use it, no module permission.
async function requireMe(): Promise<number> {
  const access = await getAccess();
  if (!access.user) throw new Error("Unauthorized");
  return access.user.id;
}

export async function sendMessageAction(input: {
  conversationId?: number;
  toUserId?: number;
  body?: string;
  replyToId?: number;
  attachments?: { assetId: string; width?: number; height?: number }[];
}) {
  return chat.sendMessage(await requireMe(), input);
}

export async function editMessageAction(messageId: number, body: string) {
  return chat.editMessage(await requireMe(), messageId, body);
}

export async function unsendMessageAction(messageId: number) {
  return chat.unsendMessage(await requireMe(), messageId);
}

export async function markReadAction(conversationId: number) {
  return chat.markRead(await requireMe(), conversationId);
}

export async function startConversationAction(toUserId: number) {
  const me = await requireMe();
  if (toUserId === me) return { error: "chat.err.self" as const };
  const c = await chat.getOrCreateConversation(me, toUserId);
  return { conversationId: c.id };
}

export async function loadConversationsAction() {
  return chat.listConversations(await requireMe());
}

export async function loadMessagesAction(conversationId: number) {
  return chat.listMessages(await requireMe(), conversationId);
}

export async function loadChatablePeopleAction() {
  return chat.listChatablePeople(await requireMe());
}
