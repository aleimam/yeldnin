import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  makeT,
  type Locale,
  type TFunction,
} from "./index";

/** Resolve the active locale from the cookie (server-side). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Server translation helper: `const t = await getT()`. */
export async function getT(): Promise<TFunction> {
  return makeT(await getLocale());
}
