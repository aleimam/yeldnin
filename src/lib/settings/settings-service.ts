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
  versionShowMobile: boolean;
  versionShowDesktop: boolean;
  copyrightEn: string | null;
  copyrightAr: string | null;
  docLetterheadAssetId: string | null;
  docMarginTopMm: number;
  docMarginBottomMm: number;
  docMarginLeftMm: number;
  docMarginRightMm: number;
}

const FALLBACK: PlatformSettingsView = {
  appName: "YeldnIN",
  themeKey: "default",
  logoUrl: null,
  darkLogoUrl: null,
  faviconUrl: null,
  version: "1.18",
  versionShowMobile: false,
  versionShowDesktop: true,
  copyrightEn: null,
  copyrightAr: null,
  docLetterheadAssetId: null,
  docMarginTopMm: 45,
  docMarginBottomMm: 30,
  docMarginLeftMm: 22,
  docMarginRightMm: 22,
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
      versionShowMobile: row.versionShowMobile,
      versionShowDesktop: row.versionShowDesktop,
      copyrightEn: row.copyrightEn,
      copyrightAr: row.copyrightAr,
      docLetterheadAssetId: row.docLetterheadAssetId,
      docMarginTopMm: row.docMarginTopMm,
      docMarginBottomMm: row.docMarginBottomMm,
      docMarginLeftMm: row.docMarginLeftMm,
      docMarginRightMm: row.docMarginRightMm,
    };
  },
);

/** Update the Documents-module letterhead + generated-PDF margins (admin only). */
export async function updateDocSettings(input: {
  docLetterheadAssetId?: string | null;
  docMarginTopMm?: number;
  docMarginBottomMm?: number;
  docMarginLeftMm?: number;
  docMarginRightMm?: number;
}) {
  await prisma.platformSettings.update({ where: { id: 1 }, data: input });
}

export async function updateAppearance(input: {
  appName?: string;
  themeKey?: string;
  logoUrl?: string | null;
  darkLogoUrl?: string | null;
  faviconUrl?: string | null;
  version?: string;
  versionShowMobile?: boolean;
  versionShowDesktop?: boolean;
  copyrightEn?: string | null;
  copyrightAr?: string | null;
}) {
  await prisma.platformSettings.update({
    where: { id: 1 },
    data: input,
  });
}
