import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

export interface PlatformSettingsView {
  appName: string;
  themeKey: string;
  logoUrl: string | null;
  darkLogoUrl: string | null;
  faviconUrl: string | null;
  version: string;
}

const FALLBACK: PlatformSettingsView = {
  appName: "YeldnIN",
  themeKey: "default",
  logoUrl: null,
  darkLogoUrl: null,
  faviconUrl: null,
  version: "1.2",
};

/** Read the single platform-settings row (memoized per request). */
export const getPlatformSettings = cache(
  async (): Promise<PlatformSettingsView> => {
    const row = await prisma.platformSettings.findUnique({ where: { id: 1 } });
    if (!row) return FALLBACK;
    return {
      appName: row.appName,
      themeKey: row.themeKey,
      logoUrl: row.logoUrl,
      darkLogoUrl: row.darkLogoUrl,
      faviconUrl: row.faviconUrl,
      version: row.version,
    };
  },
);

export async function updateAppearance(input: {
  appName?: string;
  themeKey?: string;
  logoUrl?: string | null;
  darkLogoUrl?: string | null;
  faviconUrl?: string | null;
}) {
  await prisma.platformSettings.update({
    where: { id: 1 },
    data: input,
  });
}
