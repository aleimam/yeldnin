import Link from "next/link";
import { getT } from "@/i18n/server";
import { getAccess, type SessionUser } from "@/lib/auth/access";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { assetUrl } from "@/lib/assets/assets-service";
import { getEffectiveTheme, getColorMode } from "@/lib/prefs";
import { MODULES, childModules } from "@/lib/modules";
import { canAccessSettings } from "@/lib/module-sections";
import { canAccessCs } from "@/lib/cs/cs-logic";
import { unreadCount } from "@/lib/notify/notify-message-service";
import { PreferencesMenu } from "./PreferencesMenu";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ModuleSwitcher } from "./ModuleSwitcher";
import { AccountMenu } from "./AccountMenu";
import { GlobalSearch } from "./GlobalSearch";

const TIER_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEMBER: "Member",
};

/**
 * Application top bar. When `activeModuleKey` is set (inside a module, within a
 * SidebarProvider) it shows the module name + a mobile menu button.
 */
export async function TopBar({
  user,
  activeModuleKey,
}: {
  user: SessionUser;
  activeModuleKey?: string;
}) {
  const [t, access, settings, theme, mode, unread] = await Promise.all([
    getT(),
    getAccess(),
    getPlatformSettings(),
    getEffectiveTheme(),
    getColorMode(),
    unreadCount(user.id),
  ]);
  const showSettings = canAccessSettings(access.can, access.isAdmin);
  const logo = assetUrl(settings.logoUrl);
  const darkLogo = assetUrl(settings.darkLogoUrl) ?? logo;

  const canSee = (key: string) =>
    key === "settings"
      ? canAccessSettings(access.can, access.isAdmin)
      : key === "cs_quality"
        ? canAccessCs(access)
        : access.canModule(key) || childModules(key).some((c) => access.canModule(c));
  // Folded-in modules (e.g. purchasing → logistics) don't get their own tile.
  const switcherModules = MODULES.filter((m) => !m.foldedInto && canSee(m.key)).map((m) => ({
    key: m.key,
    label: t(`module.${m.key}.name`),
    icon: m.icon,
    href: m.route,
  }));
  const activeModuleName = activeModuleKey ? t(`module.${activeModuleKey}.name`) : null;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        {/* Logo + name + version */}
        <Link href="/" className="flex items-center gap-2">
          {logo ? (
            <>
              <img src={logo} alt={settings.appName} className="h-7 w-auto dark:hidden" />
              <img src={darkLogo!} alt={settings.appName} className="hidden h-7 w-auto dark:block" />
            </>
          ) : (
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-brand-fg">✦</span>
          )}
          <span className="text-lg font-bold text-ink">{settings.appName}</span>
          <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-muted">
            v{settings.version}
          </span>
        </Link>

        {/* Active module name */}
        {activeModuleName && (
          <span className="hidden items-center gap-2 sm:flex">
            <span className="text-line">·</span>
            <span className="font-semibold text-ink">{activeModuleName}</span>
          </span>
        )}

        {/* Module switcher */}
        <ModuleSwitcher modules={switcherModules} activeKey={activeModuleKey} />

        {/* Global search */}
        <GlobalSearch />

        {/* Right cluster */}
        <div className="ms-auto flex items-center gap-3">
          <LocaleSwitcher />
          <PreferencesMenu theme={theme} mode={mode} />
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm font-medium text-ink">{user.name}</span>
            <span className="role-badge">{TIER_LABEL[user.tier] ?? user.tier}</span>
          </div>
          <Link href="/notifications" aria-label={t("common.notifications")} className="relative text-muted hover:text-ink">
            🔔
            {unread > 0 && (
              <span className="absolute -end-1 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <AccountMenu
            name={user.name}
            email={user.email}
            tier={user.tier}
            avatarUrl={assetUrl(user.avatarUrl)}
            showSettings={showSettings}
          />
        </div>
      </div>
    </header>
  );
}
