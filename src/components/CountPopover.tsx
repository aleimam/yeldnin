"use client";
import { useEffect, useRef, useState } from "react";

/**
 * A click-to-open popover that lists items (product name + count). Closes when
 * the user clicks anywhere outside it. The `trigger` is rendered as the clickable
 * summary (e.g. the item-count badges).
 */
export function CountPopover({ trigger, items, empty }: { trigger: React.ReactNode; items: { name: string; count: number }[]; empty: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className="cursor-pointer text-start hover:opacity-75">
        {trigger}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-60 overflow-auto rounded-lg border border-line bg-surface p-2 text-start shadow-lg">
          {items.length === 0 ? (
            <p className="px-1 py-1 text-xs text-muted">{empty}</p>
          ) : (
            <ul className="divide-y divide-line/60 text-sm">
              {items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-ink [overflow-wrap:anywhere]">{it.name}</span>
                  <span className="shrink-0 font-medium text-muted">×{it.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
