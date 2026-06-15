import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_THEME,
  THEME_COOKIE,
  MODE_COOKIE,
  isThemeKey,
  isColorMode,
  type ColorMode,
} from "@/lib/theme";
import { getPlatformSettings } from "@/lib/settings/settings-service";

/** Effective theme = per-user cookie override, else the app default. */
export async function getEffectiveTheme(): Promise<string> {
  const store = await cookies();
  const cookieTheme = store.get(THEME_COOKIE)?.value;
  if (isThemeKey(cookieTheme)) return cookieTheme!;
  const settings = await getPlatformSettings();
  return isThemeKey(settings.themeKey) ? settings.themeKey : DEFAULT_THEME;
}

/** Color mode from the per-user cookie (default: system). */
export async function getColorMode(): Promise<ColorMode> {
  const store = await cookies();
  const m = store.get(MODE_COOKIE)?.value;
  return isColorMode(m) ? m : "system";
}
