import Link from "next/link";
import { getT, getLocale } from "@/i18n/server";
import { getAccess, type SessionUser } from "@/lib/auth/access";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { assetUrl } from "@/lib/assets/assets-service";
import { getEffectiveTheme, getColorMode } from "@/lib/prefs";
import { PreferencesMenu } from "./PreferencesMenu";

const TIER_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEMBER: "Member",
};

/** Application top bar — matches the v1.28 layout. */
export async function TopBar({ user }: { user: SessionUser }) {
  const [t, access, settings, locale, theme, mode] = await Promise.all([
    getT(),
    getAccess(),
    getPlatformSettings(),
    getLocale(),
    getEffectiveTheme(),
    getColorMode(),
  ]);
  const showSettings = access.canModule("settings");
  const logo = assetUrl(settings.logoUrl);
  const darkLogo = assetUrl(settings.darkLogoUrl) ?? logo;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        {/* Logo + name + version */}
        <Link href="/" className="flex items-center gap-2">
          {logo ? (
            <>
              <img src={logo} alt={settings.appName} className="h-7 w-auto dark:hidden" />
              <img src={darkLogo!} alt={settings.appName} className="hidden h-7 w-auto dark:block" />
            </>
          ) : (
            <>
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-brand-fg">
                ✦
              </span>
              <span className="text-lg font-bold text-ink">{settings.appName}</span>
            </>
          )}
          <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-muted">
            v{settings.version}
          </span>
        </Link>

        {/* Module switcher (placeholder dropdown) */}
        <button className="btn-secondary hidden h-8 px-3 text-xs sm:inline-flex">
          {t("common.allModules")} ▾
        </button>

        {/* Global search */}
        <div className="hidden flex-1 justify-center md:flex">
          <input
            className="input max-w-sm"
            placeholder={t("common.search")}
            aria-label={t("common.search")}
          />
        </div>

        {/* Right cluster */}
        <div className="ms-auto flex items-center gap-3">
          <PreferencesMenu locale={locale} theme={theme} mode={mode} />
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm font-medium text-ink">{user.name}</span>
            <span className="role-badge">{TIER_LABEL[user.tier] ?? user.tier}</span>
          </div>
          <button aria-label={t("common.notifications")} className="text-muted hover:text-ink">
            🔔
          </button>
          {showSettings && (
            <Link
              href="/settings"
              aria-label={t("common.settings")}
              className="text-muted hover:text-ink"
            >
              ⚙️
            </Link>
          )}
          <form method="POST" action="/api/logout">
            <button
              type="submit"
              className="text-sm text-muted hover:text-ink"
              title={t("common.signOut")}
            >
              ⎋
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
