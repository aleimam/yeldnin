"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { isThemeKey } from "@/lib/theme";
import { saveUpload } from "@/lib/assets/assets-service";
import { updateAppearance } from "@/lib/settings/settings-service";

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
  await requireModule("settings", "MANAGE");

  const appName = String(formData.get("appName") ?? "").trim();
  const themeKey = String(formData.get("themeKey") ?? "default");

  const updates: {
    appName?: string;
    themeKey?: string;
    logoUrl?: string;
    darkLogoUrl?: string;
    faviconUrl?: string;
  } = {};
  if (appName) updates.appName = appName;
  if (isThemeKey(themeKey)) updates.themeKey = themeKey;

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
  revalidatePath("/", "layout"); // refresh app name / logo / favicon / theme everywhere
  return { ok: true };
}
