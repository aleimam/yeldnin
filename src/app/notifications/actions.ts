"use server";
import { requireUser } from "@/lib/auth/access";
import { markRead, markAllRead } from "@/lib/notify/notify-message-service";

export async function markReadAction(recipientId: number): Promise<void> {
  const access = await requireUser();
  await markRead(recipientId, access.user.id);
}

export async function markAllReadAction(): Promise<void> {
  const access = await requireUser();
  await markAllRead(access.user.id);
}
