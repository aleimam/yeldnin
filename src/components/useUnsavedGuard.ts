"use client";
import { useEffect } from "react";

/**
 * Warn before losing unsaved form edits. While `dirty` is true:
 *  - a browser unload (tab close, refresh, navigating to an external URL, or
 *    backing out of the app) shows the native "Leave site?" prompt;
 *  - clicking an in-app link first asks for confirmation — the App Router has no
 *    built-in navigation block, so we intercept the anchor click ourselves.
 *
 * `message` is the confirm() text for in-app navigations (browsers control the
 * unload prompt's wording). Programmatic navigation (e.g. router.push after a
 * successful save) is never intercepted, so the post-save redirect is unaffected.
 */
export function useUnsavedGuard(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // Chrome requires returnValue to be set to show the prompt.
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    // Capture-phase, on document, so we run before React's delegated click handler
    // (and Next's Link) — stopping propagation there cancels the SPA navigation.
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || href.startsWith("#") || (target && target !== "_self")) return;
      let dest: URL;
      try {
        dest = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (dest.origin !== window.location.origin) return; // external → beforeunload handles it
      if (dest.pathname === window.location.pathname && dest.search === window.location.search) return; // same page / hash only
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [dirty, message]);
}
