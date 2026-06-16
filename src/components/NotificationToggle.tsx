"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import {
  getPushConfigAction,
  subscribeAction,
  unsubscribeAction,
  sendTestAction,
} from "@/lib/notify/actions";

// VAPID public keys are URL-safe base64; PushManager wants an ArrayBuffer-backed
// Uint8Array (TS's BufferSource is parameterized to ArrayBuffer specifically).
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied" | "not-configured";

export function NotificationToggle() {
  const t = useT();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) return alive && setState("unsupported");

      const cfg = await getPushConfigAction();
      if (!alive) return;
      if (!cfg.publicKey || !cfg.enabled) return setState("not-configured");
      if (Notification.permission === "denied") return setState("denied");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!alive) return;
      setState(sub ? "on" : "off");
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const cfg = await getPushConfigAction();
      if (!cfg.publicKey || !cfg.enabled) return setState("not-configured");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await subscribeAction({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
      setState("on");
    } catch {
      setMsg(t("notify.error"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const { endpoint } = sub;
        await sub.unsubscribe();
        await unsubscribeAction(endpoint);
      }
      setState("off");
    } catch {
      setMsg(t("notify.error"));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendTestAction();
      setMsg(r.ok ? t("notify.sent") : t("notify.error"));
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <p className="text-sm text-muted">…</p>;
  if (state === "unsupported") return <p className="text-sm text-muted">{t("notify.unsupported")}</p>;
  if (state === "not-configured") return <p className="text-sm text-muted">{t("notify.notConfigured")}</p>;
  if (state === "denied") return <p className="text-sm text-amber-600">{t("notify.blocked")}</p>;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === "off" ? (
        <button type="button" className="btn-primary" disabled={busy} onClick={enable}>
          {busy ? t("notify.enabling") : t("notify.enable")}
        </button>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
            <span>🔔</span> {t("notify.on")}
          </span>
          <button type="button" className="btn-secondary" disabled={busy} onClick={test}>
            {t("notify.test")}
          </button>
          <button
            type="button"
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={disable}
          >
            {t("notify.disable")}
          </button>
        </>
      )}
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
