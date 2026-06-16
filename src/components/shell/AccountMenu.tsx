"use client";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { useDropdown } from "@/lib/use-dropdown";

const TIER_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEMBER: "Member",
};

/** Gear-triggered account menu: user info, Settings link, Sign out. */
export function AccountMenu({
  name,
  email,
  tier,
  showSettings,
}: {
  name: string;
  email: string;
  tier: string;
  showSettings: boolean;
}) {
  const t = useT();
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-muted hover:text-ink"
        aria-label={t("common.settings")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⚙️
      </button>

      {open && (
        <div className="absolute end-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <div className="border-b border-line px-3 py-3">
            <div className="truncate text-sm font-medium text-ink">{name}</div>
            <div className="truncate text-xs text-muted">{email}</div>
            <span className="role-badge mt-1 inline-block">{TIER_LABEL[tier] ?? tier}</span>
          </div>

          <div className="p-1.5">
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
