import en from "./en.json";
import ar from "./ar.json";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "yeldnin_locale";

export type Dict = Record<string, string>;

export const dictionaries: Record<Locale, Dict> = {
  en: en as Dict,
  ar: ar as Dict,
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "ar";
}

export function dir(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Translate a key with optional {placeholder} interpolation. Falls back to en, then the key. */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const value =
    dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE]?.[key] ?? key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/** Bind a translator to a fixed locale — for server jobs / notifications that
 *  render outside a request (no cookie), e.g. per-recipient push payloads. */
export function makeT(locale: Locale): TFunction {
  return (key, vars) => translate(locale, key, vars);
}
