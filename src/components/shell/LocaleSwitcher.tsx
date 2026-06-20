"use client";
import { useLocale } from "@/i18n/client";
import { LOCALE_COOKIE, type Locale } from "@/i18n";
import { persistPrefs } from "@/app/prefs-actions";
import { writePrefCookie } from "@/lib/ui/pref-cookie";

export function LocaleSwitcher() {
  const locale = useLocale();

  function setLocale(next: Locale) {
    if (next === locale) return;
    // 1 year cookie + persist to the account (no-op when signed out); reload so
    // server components re-render in the new locale/dir.
    writePrefCookie(LOCALE_COOKIE, next);
    void persistPrefs({ locale: next });
    window.location.reload();
  }

  return (
    <div className="flex items-center rounded-lg border border-line text-xs">
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-s-lg px-2 py-1 ${locale === "en" ? "bg-brand text-brand-fg" : "text-muted hover:text-ink"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("ar")}
        className={`rounded-e-lg px-2 py-1 ${locale === "ar" ? "bg-brand text-brand-fg" : "text-muted hover:text-ink"}`}
      >
        ع
      </button>
    </div>
  );
}
