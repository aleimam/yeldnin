"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Dropdown open-state with reliable close-on-outside-click + Escape.
 *
 * Attach `ref` to the wrapper that contains BOTH the trigger and the panel.
 * Uses a document-level listener (not a fixed backdrop) so it works even when
 * an ancestor has a blur/filter that would trap a `position: fixed` overlay.
 */
export function useDropdown<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, setOpen, ref };
}
