import Link from "next/link";
import { getT } from "@/i18n/server";
import { TopBar } from "@/components/shell/TopBar";
import { MAIN_MODULES, ADMIN_MODULES, type ModuleDef } from "@/lib/modules";
import { requireUser } from "@/lib/auth/access";
import { canAccessSettings } from "@/lib/module-sections";
import { SiteFooter } from "@/components/shell/SiteFooter";
import type { TFunction } from "@/i18n";

function ModuleCard({ m, t }: { m: ModuleDef; t: TFunction }) {
  return (
    <Link
      href={m.route}
      className="card group flex items-start gap-4 p-5 transition hover:shadow-md hover:ring-1 hover:ring-brand/30"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-canvas text-2xl">
        {m.icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-ink group-hover:text-brand">
          {t(`module.${m.key}.name`)}
        </span>
        <span className="block text-sm text-muted">{t(`module.${m.key}.desc`)}</span>
      </span>
    </Link>
  );
}

export default async function DashboardPage() {
  const access = await requireUser();
  const t = await getT();

  const canSee = (key: string) =>
    key === "settings" ? canAccessSettings(access.can, access.isAdmin) : access.canModule(key);
  const mainVisible = MAIN_MODULES.filter((m) => canSee(m.key));
  const adminVisible = ADMIN_MODULES.filter((m) => canSee(m.key));

  return (
    <>
      <TopBar user={access.user} />
      <main className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-ink">{t("dashboard.welcome")}</h1>
          <p className="mt-1 text-muted">{t("dashboard.choose")}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mainVisible.map((m) => (
            <ModuleCard key={m.key} m={m} t={t} />
          ))}
        </div>

        {adminVisible.length > 0 && (
          <>
            <h2 className="mb-4 mt-10 text-xs font-semibold tracking-widest text-muted">
              {t("common.administration")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {adminVisible.map((m) => (
                <ModuleCard key={m.key} m={m} t={t} />
              ))}
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
