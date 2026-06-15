"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";

export function PricerNav({ canManage }: { canManage: boolean }) {
  const t = useT();
  const path = usePathname();
  const tabs = [
    { href: "/pricer/supplements", label: t("pricer.supplements") },
    { href: "/pricer/devices", label: t("pricer.devices") },
    { href: "/pricer/history", label: t("pricer.history") },
    ...(canManage ? [{ href: "/pricer/variables", label: t("pricer.variables") }] : []),
  ];
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((tab) => {
        const active = path === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
