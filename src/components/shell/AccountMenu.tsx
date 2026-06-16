"use client";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { useDropdown } from "@/lib/use-dropdown";

const TIER_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEMBER: "Member",
};

/** Avatar-triggered account menu: user info, Settings link, Sign out. */
export function AccountMenu({
  name,
  email,
  tier,
  avatarUrl,
  showSettings,
}: {
  name: string;
  email: string;
  tier: string;
  avatarUrl: string | null;
  showSettings: boolean;
}) {
  const t = useT();
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-line bg-canvas text-muted hover:text-ink"
        aria-label={t("common.settings")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span>⚙️</span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <div className="flex items-center gap-3 border-b border-line px-3 py-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-canvas text-lg">👤</span>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">{name}</div>
              <div className="truncate text-xs text-muted">{email}</div>
              <span className="role-badge mt-1 inline-block">{TIER_LABEL[tier] ?? tier}</span>
            </div>
          </div>

          <div className="p-1.5">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas"
            >
              <span>🔔</span>
              {t("common.notifications")}
            </Link>
            {showSettings && (
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas"
              >
                <span>⚙️</span>
                {t("common.settings")}
              </Link>
            )}
            <form method="POST" action="/api/logout">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <span>⎋</span>
                {t("common.signOut")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
