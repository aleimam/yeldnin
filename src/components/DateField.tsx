"use client";
import { useEffect, useRef, useState } from "react";
import { isoToDisplay, displayToIso } from "@/lib/format/date-input";

type ChangeLike = { target: { value: string } };

/**
 * Drop-in replacement for `<input type="date">`. Shows and accepts **DD/MM/YYYY**
 * (locale-stable — good for far dates like birth/hiring) and keeps a calendar
 * popup for quick same-year picks. `value` + `onChange` use ISO `yyyy-mm-dd`
 * exactly like the native input, so existing handlers (incl. `e.target.value`)
 * work unchanged — only the tag name changes at call sites.
 */
export function DateField({
  value,
  onChange,
  className = "input",
  min,
  max,
  id,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (e: ChangeLike) => void;
  className?: string;
  min?: string;
  max?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const dateRef = useRef<HTMLInputElement>(null);
  // Reflect external value changes (form reset, programmatic set) into the box.
  useEffect(() => { setText(isoToDisplay(value)); }, [value]);

  const emit = (iso: string) => onChange({ target: { value: iso } });

  return (
    <div className="flex items-stretch gap-1">
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        id={id}
        aria-label={ariaLabel}
        className={className}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const iso = displayToIso(e.target.value);
          if (iso) emit(iso);
          else if (e.target.value.trim() === "") emit("");
        }}
      />
      {/* Calendar box: a 📅 with a transparent native date input over it that
          opens the system picker; its ISO value feeds the same onChange. */}
      <span className="relative grid w-9 shrink-0 place-items-center rounded-md border border-line text-sm text-muted">
        <span aria-hidden>📅</span>
        <input
          ref={dateRef}
          type="date"
          value={value}
          min={min}
          max={max}
          tabIndex={-1}
          aria-label={ariaLabel ? `${ariaLabel} (calendar)` : "calendar"}
          onClick={() => { try { dateRef.current?.showPicker?.(); } catch { /* native click fallback */ } }}
          onChange={(e) => { emit(e.target.value); setText(isoToDisplay(e.target.value)); }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </span>
    </div>
  );
}
