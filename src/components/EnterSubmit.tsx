"use client";

import { useEffect } from "react";

/**
 * Global Enter-to-submit. Pressing Enter in a normal single-line input fires
 * that form's primary action — the app's `.btn-primary` (Save / Create /
 * Calculate / …) within the nearest `.card` — so Enter behaves like clicking it.
 *
 * Left alone: native <form> elements (they submit on Enter already), textareas
 * (multi-line), and non-text inputs (checkbox/radio/file/…). Modifier+Enter is
 * ignored so Shift+Enter etc. keep their meaning.
 */
export function EnterSubmit() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const el = e.target as HTMLElement | null;
      if (!el || el.tagName !== "INPUT") return;
      const type = (el as HTMLInputElement).type;
      if (["checkbox", "radio", "file", "button", "submit", "reset", "range", "color"].includes(type)) return;
      if (el.closest("form")) return; // a real <form> already submits on Enter
      const scope = el.closest<HTMLElement>(".card");
      if (!scope) return;
      const btn =
        scope.querySelector<HTMLButtonElement>("button.btn-primary:not([disabled])") ??
        scope.querySelector<HTMLButtonElement>('button[type="submit"]:not([disabled])');
      if (!btn) return;
      e.preventDefault();
      btn.click();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
