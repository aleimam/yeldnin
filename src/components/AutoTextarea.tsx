"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

// Use layout effect on the client, plain effect on the server (avoids SSR warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Visible rows before it grows (the starting height). Default 1. */
  minRows?: number;
  /** Grow up to this many lines, then scroll inside the box. Default 5. */
  maxRows?: number;
};

/**
 * A `<textarea>` that wears the shared `.input` style and auto-grows to fit its
 * content — starts at `minRows` and expands up to `maxRows` lines, after which it
 * scrolls internally. The single, app-wide way to enter notes / comments / reasons
 * so the writer can see a short paragraph without a tiny scrolling box.
 */
export function AutoTextarea({ minRows = 1, maxRows = 5, className = "", value, onChange, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto"; // reset so scrollHeight reflects the true content height
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 20;
    const extra =
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const max = Math.ceil(maxRows * line + extra);
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [maxRows]);

  // Re-fit on mount and whenever the controlled value changes (typing, paste, reset).
  useIsoLayoutEffect(resize, [resize, value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => { onChange?.(e); resize(); }}
      onInput={resize}
      className={`input resize-none ${className}`}
      {...rest}
    />
  );
}
