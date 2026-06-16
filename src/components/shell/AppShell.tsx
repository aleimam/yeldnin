import Link from "next/link";
import { cookies } from "next/headers";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { SidebarProvider } from "./SidebarContext";
import type { Access, SessionUser } from "@/lib/auth/access";
import { sectionsFor, visibleSettingsGroups, SIDEBAR_COOKIE } from "@/lib/module-sections";

/**
 * Authenticated module chrome: top bar + collapsible sidebar (the module's
 * sections, permission-filtered) + a titled content area.
 */
export async function AppShell({
  access,
  moduleKey,
  pageTitle,
  backHref,
  actions,
  children,
}: {
  access: Access & { user: SessionUser };
  moduleKey: string;
  pageTitle?: string;
  backHref?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const store = await cookies();
  const initialCollapsed = store.get(SIDEBAR_COOKIE)?.value === "collapsed";

  const isSettings = moduleKey === "settings";
  const groups = isSettings ? visibleSettingsGroups(access.canModule) : undefined;
  const sections = isSettings
    ? []
    : sectionsFor(moduleKey)
        .filter((s) => access.canModule(moduleKey, s.minLevel ?? "VIEW"))
        .map((s) => ({ labelKey: s.labelKey, icon: s.icon, href: s.href }));
  const hasNav = isSettings ? (groups?.length ?? 0) > 0 : sections.length > 0;

  return (
    <SidebarProvider initialCollapsed={initialCollapsed}>
      <TopBar user={access.user} activeModuleKey={moduleKey} />
      <div className="mx-auto flex max-w-7xl">
        {hasNav && <Sidebar sections={sections} groups={groups} />}
        <main className="min-w-0 flex-1 px-4 py-8">
          {(pageTitle || actions || backHref) && (
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {backHref && (
                  <Link href={backHref} className="text-muted hover:text-ink" aria-label="Back">
                    ←
                  </Link>
                )}
                {pageTitle && <h1 className="text-xl font-bold text-ink">{pageTitle}</h1>}
              </div>
              {actions}
            </div>
          )}
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
