import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { assetUrl } from "@/lib/assets/assets-service";
import { AppearanceForm } from "./AppearanceForm";

export default async function AppearanceSettingsPage() {
  const access = await requireModule("settings", "MANAGE");
  const [t, s] = await Promise.all([getT(), getPlatformSettings()]);

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("settings.appearance.title")} backHref="/settings">
      <AppearanceForm
        current={{
          appName: s.appName,
          themeKey: s.themeKey,
          logoUrl: assetUrl(s.logoUrl),
          darkLogoUrl: assetUrl(s.darkLogoUrl),
          faviconUrl: assetUrl(s.faviconUrl),
        }}
      />
    </AppShell>
  );
}
