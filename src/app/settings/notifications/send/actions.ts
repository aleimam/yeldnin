"use server";
import { requireCapability } from "@/lib/auth/access";
import { sendCustomNotification } from "@/lib/notify/notify-message-service";
import { writeAudit } from "@/lib/audit";

export type SendResult = { ok: true; count: number } | { ok: false; error: string };

export async function sendNotificationAction(p: {
  title: string;
  body: string;
  link?: string | null;
  imageAssetId?: string | null;
  type?: string;
  target: { all?: boolean; userIds?: number[]; teamKeys?: string[] };
}): Promise<SendResult> {
  const access = await requireCapability("settings", "sendNotifications");
  if (!p.title?.trim()) return { ok: false, error: "Title is required." };
  if (!p.body?.trim()) return { ok: false, error: "Message is required." };
  try {
    const count = await sendCustomNotification(p, access.user.id);
    await writeAudit(access.user.id, "settings", "notification.send", "notification", 0, { count });
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not send the notification." };
  }
}
