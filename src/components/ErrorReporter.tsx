"use client";
import { useEffect } from "react";

/** Reports uncaught client errors + unhandled promise rejections to the Error
 *  Log (best-effort, throttled). Mounted once in the root layout. */
export function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const CAP = 20; // don't flood the log from one tab session

    const report = (message: string, stack: string | null) => {
      if (sent >= CAP || !message) return;
      sent++;
      try {
        const body = JSON.stringify({ message, stack, url: location.pathname + location.search });
        if (navigator.sendBeacon) navigator.sendBeacon("/api/error-log", new Blob([body], { type: "application/json" }));
        else void fetch("/api/error-log", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
      } catch {
        /* ignore */
      }
    };

    const onError = (e: ErrorEvent) => report(e.message || String(e.error), e.error?.stack ?? null);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | string | undefined;
      const message = typeof r === "string" ? r : r?.message || "Unhandled promise rejection";
      report(message, typeof r === "object" ? r?.stack ?? null : null);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
