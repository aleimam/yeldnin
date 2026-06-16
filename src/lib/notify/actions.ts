"use server";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/access";
import {
  saveSubscription,
  deleteSubscription,
  sendToUsers,
  pushPublicKey,
  pushEnabled,
  type ClientSubscription,
} from "./notify-service";

/** Client bootstraps with this: the VAPID public key + whether sending works. */
export async function getPushConfigAction(): Promise<{ publicKey: string | null; enabled: boolean }> {
  await requireUser();
  return { publicKey: pushPublicKey(), enabled: pushEnabled() };
}

export async function subscribeAction(sub: ClientSubscription): Promise<{ ok: boolean }> {
  const access = await requireUser();
  const ua = (await headers()).get("user-agent");
  await saveSubscription(access.user.id, sub, ua);
  return { ok: true };
}

export async function unsubscribeAction(endpoint: string): Promise<{ ok: boolean }> {
  await requireUser();
  await deleteSubscription(endpoint);
  return { ok: true };
}

/** Send a test push to the caller's own devices (verifies the round-trip). */
export async function sendTestAction(): Promise<{ ok: boolean; error?: string }> {
  const access = await requireUser();
  if (!pushEnabled()) return { ok: false, error: "not-configured" };
  await sendToUsers([access.user.id], {
    title: "YeldnIN",
    body: "Test notification — push is working ✅",
    url: "/account",
    tag: "test",
  });
  return { ok: true };
}
