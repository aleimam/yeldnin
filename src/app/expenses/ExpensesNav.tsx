"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";

export function ExpensesNav({ canManage }: { canManage: boolean }) {
  const t = useT();
  const path = usePathname();
  const tabs = [
    { href: "/expenses/dashboard", label: t("exp.dashboard") },
    { href: "/expenses/transactions", label: t("exp.transactions") },
    { href: "/expenses/reports", label: t("exp.reports") },
    { href: "/expenses/reconciliation", label: t("exp.reconciliation") },
    ...(canManage
      ? [
          { href: "/expenses/admin/monthly-sales", label: t("exp.monthlySales") },
          { href: "/expenses/admin/bank-collections", label: t("exp.bankCollections") },
          { href: "/expenses/admin/categories", label: t("exp.categories") },
          { href: "/expenses/admin/accounts", label: t("exp.accounts") },
          { href: "/expenses/admin/audit", label: t("exp.audit") },
        ]
      : []),
  ];
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((tab) => {
        const active = path === tab.href || path.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
