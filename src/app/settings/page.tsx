import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";

export default async function SettingsPage() {
  const access = await requireModule("settings", "VIEW");
  const t = await getT();

  const sections = [
    {
      href: "/settings/appearance",
      icon: "🎨",
      title: t("settings.appearance.title"),
      desc: t("module.settings.desc"),
    },
    {
      href: "/settings/logistics",
      icon: "🚚",
      title: t("suppliers.title"),
      desc: t("module.logistics.desc"),
    },
  ];

  return (
    <AppShell user={access.user} title={t("module.settings.name")} backHref="/">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card group flex items-start gap-4 p-5 transition hover:shadow-md hover:ring-1 hover:ring-brand/30"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-canvas text-2xl">
              {s.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-ink group-hover:text-brand">
                {s.title}
              </span>
              <span className="block text-sm text-muted">{s.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
