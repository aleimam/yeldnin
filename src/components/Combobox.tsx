"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n/client";

export interface ComboOption {
  value: string;
  label: string; // primary text (e.g. product name)
  hint?: string; // muted secondary text shown on the right (e.g. SKU)
}

/**
 * A searchable single-select. Type to filter the options instantly (matches both
 * `label` and `hint`); pick with the mouse or arrow-keys + Enter. Drop-in for a
 * `<select>` that has grown too long to scroll. All filtering is client-side.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  className = "",
  disabled,
}: {
  options: ComboOption[];
  value: string; // selected value ("" = none)
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const matches = filtered.slice(0, 50);
  const more = filtered.length - matches.length;

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (o: ComboOption) => { onChange(o.value); setQuery(""); setOpen(false); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") {
      // While open, Enter selects — and must NOT bubble to the global Enter-to-submit.
      if (open) { e.preventDefault(); e.stopPropagation(); if (matches[active]) choose(matches[active]); }
    } else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        className="input w-full"
        value={open ? query : (selected?.label ?? "")}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t("combo.noMatches")}</li>}
          {matches.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep input focus so onClick fires
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-sm ${i === active ? "bg-canvas" : ""} ${o.value === value ? "font-medium text-brand" : "text-ink"}`}
              >
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-muted">{o.hint}</span>}
              </button>
            </li>
          ))}
          {more > 0 && <li className="px-3 py-1.5 text-xs text-muted">{t("combo.more", { n: more })}</li>}
        </ul>
      )}
    </div>
  );
}
