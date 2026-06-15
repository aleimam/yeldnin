"use server";
import { prisma } from "@/lib/db";
import { getAccess } from "@/lib/auth/access";
import { isLocale } from "@/i18n";
import { isThemeKey, isColorMode } from "@/lib/theme";

/** Persist a user's preferences to their account (cookies handle the browser). */
export async function persistPrefs(p: {
  locale?: string;
  themeKey?: string | null;
  colorMode?: string;
}): Promise<void> {
  const access = await getAccess();
  if (!access.user) return;

  const data: { locale?: string; themeKey?: string | null; colorMode?: string } = {};
  if (p.locale && isLocale(p.locale)) data.locale = p.locale;
  if (p.themeKey === null) data.themeKey = null;
  else if (p.themeKey && isThemeKey(p.themeKey)) data.themeKey = p.themeKey;
  if (p.colorMode && isColorMode(p.colorMode)) data.colorMode = p.colorMode;

  if (Object.keys(data).length === 0) return;
  await prisma.user.update({ where: { id: access.user.id }, data });
}
