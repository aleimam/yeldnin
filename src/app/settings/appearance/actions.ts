"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { isThemeKey } from "@/lib/theme";
import { saveUpload } from "@/lib/assets/assets-service";
import { updateAppearance } from "@/lib/settings/settings-service";
import { writeAudit } from "@/lib/audit";

export interface FormState {
  error?: string;
  ok?: boolean;
}

const UPLOAD_FIELDS: Array<[field: string, key: "logoUrl" | "darkLogoUrl" | "faviconUrl"]> = [
  ["logo", "logoUrl"],
  ["darkLogo", "darkLogoUrl"],
  ["favicon", "faviconUrl"],
];

export async function saveAppearanceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const access = await requireCapability("settings", "manageAppearance");

  const appName = String(formData.get("appName") ?? "").trim();
  const themeKey = String(formData.get("themeKey") ?? "default");
  const version = String(formData.get("version") ?? "").trim();
  const copyrightEn = String(formData.get("copyrightEn") ?? "").trim();
  const copyrightAr = String(formData.get("copyrightAr") ?? "").trim();

  const updates: {
    appName?: string;
    themeKey?: string;
    logoUrl?: string;
    darkLogoUrl?: string;
    faviconUrl?: string;
    version?: string;
    versionShowMobile?: boolean;
    versionShowDesktop?: boolean;
    copyrightEn?: string | null;
    copyrightAr?: string | null;
  } = {};
  if (appName) updates.appName = appName;
  if (isThemeKey(themeKey)) updates.themeKey = themeKey;
  if (version) updates.version = version;
  updates.versionShowMobile = formData.get("versionShowMobile") === "on";
  updates.versionShowDesktop = formData.get("versionShowDesktop") === "on";
  updates.copyrightEn = copyrightEn || null;
  updates.copyrightAr = copyrightAr || null;

  for (const [field, key] of UPLOAD_FIELDS) {
    const f = formData.get(field);
    if (f instanceof File && f.size > 0) {
      try {
        updates[key] = await saveUpload(f);
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Upload failed." };
      }
    }
  }

  await updateAppearance(updates);
  await writeAudit(access.user.id, "settings", "settings.appearance.update", "platformSettings", 1, {
    fields: Object.keys(updates),
  });
  revalidatePath("/", "layout"); // refresh app name / logo / favicon / theme everywhere
  return { ok: true };
}
