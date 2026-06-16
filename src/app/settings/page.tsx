import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { visibleSettingsGroups, canAccessSettings } from "@/lib/module-sections";

export default async function SettingsPage() {
  const access = await requireUser();
  if (!canAccessSettings(access.canModule)) redirect("/");
  const t = await getT();
  const groups = visibleSettingsGroups(access.canModule);

  return (
    <AppShell access={access} moduleKey="settings">
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.labelKey}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
              {t(g.labelKey)}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="card group flex items-start gap-4 p-5 transition hover:shadow-md hover:ring-1 hover:ring-brand/30"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-canvas text-2xl">
                    {s.icon}
                  </span>
                  <span className="font-semibold text-ink group-hover:text-brand">{t(s.labelKey)}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
