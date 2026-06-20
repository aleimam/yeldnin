"use client";
import { useState } from "react";
import { useT } from "@/i18n/client";
import { THEMES, THEME_COOKIE, MODE_COOKIE, type ColorMode } from "@/lib/theme";
import { persistPrefs } from "@/app/prefs-actions";
import { writePrefCookie as setCookie } from "@/lib/ui/pref-cookie";

function applyMode(mode: ColorMode) {
  const dark =
    mode === "dark" ||
    (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Color-mode + theme pickers. Self-contained (writes the cookie + persists to the
 *  account); used inside the account menu so appearance lives under the ⚙️ menu. */
export function PreferencesControls({ theme, mode }: { theme: string; mode: ColorMode }) {
  const t = useT();
  const [curTheme, setCurTheme] = useState(theme);
  const [curMode, setCurMode] = useState<ColorMode>(mode);

  function chooseTheme(key: string) {
    setCurTheme(key);
    setCookie(THEME_COOKIE, key);
    document.documentElement.dataset.theme = key;
    void persistPrefs({ themeKey: key });
  }

  function chooseMode(next: ColorMode) {
    setCurMode(next);
    setCookie(MODE_COOKIE, next);
    applyMode(next);
    void persistPrefs({ colorMode: next });
  }

  const modes: ColorMode[] = ["light", "dark", "system"];

  return (
    <div>
      {/* Mode */}
      <div className="mb-3">
        <div className="mb-1.5 text-xs font-semibold text-muted">{t("pref.mode")}</div>
        <div className="flex gap-1">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => chooseMode(m)}
              className={`flex-1 rounded-lg border px-2 py-1 text-xs ${
                curMode === m ? "border-brand bg-brand text-brand-fg" : "border-line text-ink hover:bg-canvas"
              }`}
            >
              {t(`mode.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div>
        <div className="mb-1.5 text-xs font-semibold text-muted">{t("pref.theme")}</div>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((th) => (
            <button
              key={th.key}
              type="button"
              onClick={() => chooseTheme(th.key)}
              title={th.name}
              aria-label={th.name}
              className={`h-7 w-7 rounded-full border-2 ${curTheme === th.key ? "border-ink" : "border-transparent"}`}
              style={{ background: th.swatch }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
