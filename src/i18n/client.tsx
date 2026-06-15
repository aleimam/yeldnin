"use client";
import { createContext, useContext, useMemo } from "react";
import { translate, type Locale, type TFunction } from "./index";

const I18nContext = createContext<Locale>("en");

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

/** Client translation hook: `const t = useT()`. */
export function useT(): TFunction {
  const locale = useContext(I18nContext);
  return useMemo<TFunction>(
    () => (key, vars) => translate(locale, key, vars),
    [locale],
  );
}

export function useLocale(): Locale {
  return useContext(I18nContext);
}
