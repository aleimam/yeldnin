"use client";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { useDropdown } from "@/lib/use-dropdown";

export interface SwitcherModule {
  key: string;
  label: string;
  icon: string;
  href: string;
}

export function ModuleSwitcher({
  modules,
  activeKey,
}: {
  modules: SwitcherModule[];
  activeKey?: string;
}) {
  const t = useT();
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary h-8 px-3 text-xs"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="hidden sm:inline">{t("common.allModules")}</span>
        <span className="sm:hidden">{t("common.modules")}</span>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <div className="absolute start-0 z-40 mt-2 max-h-96 w-60 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          {modules.map((m) => {
              const active = m.key === activeKey;
              return (
                <Link
                  key={m.key}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    active ? "bg-brand text-brand-fg" : "text-ink hover:bg-canvas"
                  }`}
                >
                  <span className="text-base">{m.icon}</span>
                  <span className="truncate">{m.label}</span>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
