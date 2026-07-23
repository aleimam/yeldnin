"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";

const LABEL_KEYS = ["", "eval.rate1", "eval.rate2", "eval.rate3", "eval.rate4", "eval.rate5"];

/** 5-star rating input (1 Worst → 5 Outstanding). Clicking the current value
 *  clears it back to unrated (criteria are optional). Controlled. */
export function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex" role="radiogroup" aria-label={t("eval.rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-label={t(LABEL_KEYS[n])}
            aria-pressed={value === n}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => !disabled && onChange(value === n ? null : n)}
            className={`px-0.5 text-2xl leading-none transition-colors disabled:cursor-default ${
              n <= shown ? "text-amber-400" : "text-line"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <span className="min-w-[5.5rem] text-xs text-muted">{shown ? t(LABEL_KEYS[shown]) : t("eval.notRated")}</span>
    </div>
  );
}
