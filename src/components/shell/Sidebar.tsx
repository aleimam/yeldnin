"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import { useSidebar } from "./SidebarContext";

export interface SidebarSection {
  labelKey: string;
  icon: string;
  href: string;
}

function isActive(path: string, href: string): boolean {
  const base = href.split("?")[0]; // ignore query (e.g. ?m=xoonx) for active matching
  return path === base || path.startsWith(base + "/");
}

function NavList({
  sections,
  collapsed,
  onNavigate,
}: {
  sections: SidebarSection[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-2">
      {sections.map((s) => {
        const active = isActive(path, s.href);
        const label = t(s.labelKey);
        return (
          <Link
            key={s.href}
            href={s.href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-brand text-brand-fg"
                : "text-ink hover:bg-canvas"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <span className="text-lg leading-none">{s.icon}</span>
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export interface SidebarGroup {
  labelKey: string;
  items: SidebarSection[];
}

function Body({
  sections,
  groups,
  collapsed,
  onNavigate,
}: {
  sections?: SidebarSection[];
  groups?: SidebarGroup[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  if (groups) {
    return (
      <div className="py-1">
        {groups.map((g) => (
          <div key={g.labelKey} className="mb-1">
            {!collapsed && (
              <div className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {t(g.labelKey)}
              </div>
            )}
            {collapsed && <div className="mx-3 my-2 border-t border-line" />}
            <NavList sections={g.items} collapsed={collapsed} onNavigate={onNavigate} />
          </div>
        ))}
      </div>
    );
  }
  return <NavList sections={sections ?? []} collapsed={collapsed} onNavigate={onNavigate} />;
}

export function Sidebar({
  sections,
  groups,
}: {
  sections?: SidebarSection[];
  groups?: SidebarGroup[];
}) {
  const t = useT();
  const { collapsed, toggleCollapsed, drawerOpen, openDrawer, closeDrawer } = useSidebar();

  return (
    <>
      {/* Desktop rail: collapses to icons / expands to names in place */}
      <aside
        className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col border-e border-line bg-surface transition-[width] md:flex ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="flex-1 overflow-y-auto">
          <Body sections={sections} groups={groups} collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="m-2 flex items-center justify-center rounded-lg px-3 py-2 text-muted hover:bg-canvas"
          aria-label={collapsed ? t("common.expand") : t("common.collapse")}
          title={collapsed ? t("common.expand") : t("common.collapse")}
        >
          <span className="rtl-flip">{collapsed ? "»" : "«"}</span>
        </button>
      </aside>

      {/* Mobile: a persistent icon rail; the expand button slides the names
          panel over the content (the drawer below). */}
      <aside className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-16 shrink-0 flex-col overflow-y-auto border-e border-line bg-surface md:hidden">
        <Body sections={sections} groups={groups} collapsed={true} />
        <button
          type="button"
          onClick={openDrawer}
          className="m-2 flex items-center justify-center rounded-lg px-3 py-2 text-muted hover:bg-canvas"
          aria-label={t("common.expand")}
          title={t("common.expand")}
        >
          <span className="rtl-flip">»</span>
        </button>
      </aside>

      {/* Mobile names overlay (slides over content) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
          <aside className="absolute bottom-0 start-0 top-0 w-64 border-e border-line bg-surface shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-line px-3">
              <span className="font-semibold text-ink">{t("common.modules")}</span>
              <button onClick={closeDrawer} className="text-muted hover:text-ink" aria-label={t("common.collapse")}>
                <span className="rtl-flip">«</span>
              </button>
            </div>
            <div className="overflow-y-auto">
              <Body sections={sections} groups={groups} collapsed={false} onNavigate={closeDrawer} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
