"use client";
import { useState } from "react";
import { useT } from "@/i18n/client";
import { LOCALE_COOKIE, type Locale } from "@/i18n";
import {
  THEMES,
  THEME_COOKIE,
  MODE_COOKIE,
  type ColorMode,
} from "@/lib/theme";
import { persistPrefs } from "@/app/prefs-actions";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

function applyMode(mode: ColorMode) {
  const dark =
    mode === "dark" ||
    (mode !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function PreferencesMenu({
  locale,
  theme,
  mode,
}: {
  locale: Locale;
  theme: string;
  mode: ColorMode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [curTheme, setCurTheme] = useState(theme);
  const [curMode, setCurMode] = useState<ColorMode>(mode);

  function chooseLocale(next: Locale) {
    if (next === locale) return;
    setCookie(LOCALE_COOKIE, next);
    void persistPrefs({ locale: next });
    window.location.reload(); // SSR text + dir must re-render
  }

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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-muted hover:text-ink"
        aria-label={t("pref.appearance")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        🎨
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-40 mt-2 w-60 rounded-xl border border-line bg-surface p-3 shadow-lg">
            {/* Language */}
            <div className="mb-3">
              <div className="mb-1.5 text-xs font-semibold text-muted">
                {t("pref.language")}
              </div>
              <div className="flex gap-2">
                {(["en", "ar"] as Locale[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => chooseLocale(l)}
                    className={`flex-1 rounded-lg border px-2 py-1 text-sm ${
                      locale === l
                        ? "border-brand bg-brand text-brand-fg"
                        : "border-line text-ink hover:bg-canvas"
                    }`}
                  >
                    {l === "en" ? "English" : "العربية"}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode */}
            <div className="mb-3">
              <div className="mb-1.5 text-xs font-semibold text-muted">
                {t("pref.mode")}
              </div>
              <div className="flex gap-1">
                {modes.map((m) => (
                  <button
                    key={m}
                    onClick={() => chooseMode(m)}
                    className={`flex-1 rounded-lg border px-2 py-1 text-xs ${
                      curMode === m
                        ? "border-brand bg-brand text-brand-fg"
                        : "border-line text-ink hover:bg-canvas"
                    }`}
                  >
                    {t(`mode.${m}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted">
                {t("pref.theme")}
              </div>
              <div className="flex flex-wrap gap-2">
                {THEMES.map((th) => (
                  <button
                    key={th.key}
                    onClick={() => chooseTheme(th.key)}
                    title={th.name}
                    aria-label={th.name}
                    className={`h-7 w-7 rounded-full border-2 ${
                      curTheme === th.key ? "border-ink" : "border-transparent"
                    }`}
                    style={{ background: th.swatch }}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
