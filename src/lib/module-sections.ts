import type { Level } from "@/lib/auth/access-logic";

export const SIDEBAR_COOKIE = "yeldnin_sidebar"; // "open" | "collapsed"

// Sidebar sections per module. `labelKey` is an i18n key; `minLevel` hides a
// section unless the user holds at least that level on the module.
export interface SectionDef {
  labelKey: string;
  icon: string;
  href: string;
  minLevel?: Level; // default VIEW
}

export const MODULE_SECTIONS: Record<string, SectionDef[]> = {
  egv_pricer: [
    { labelKey: "pricer.supplements", icon: "💊", href: "/pricer/supplements" },
    { labelKey: "pricer.devices", icon: "🩺", href: "/pricer/devices" },
    { labelKey: "pricer.history", icon: "🕐", href: "/pricer/history" },
    { labelKey: "pricer.variables", icon: "⚙️", href: "/pricer/variables", minLevel: "MANAGE" },
  ],
  expenses: [
    { labelKey: "exp.dashboard", icon: "📊", href: "/expenses/dashboard" },
    { labelKey: "exp.transactions", icon: "🧾", href: "/expenses/transactions" },
    { labelKey: "exp.reports", icon: "📈", href: "/expenses/reports" },
    { labelKey: "exp.reconciliation", icon: "⚖️", href: "/expenses/reconciliation" },
    { labelKey: "exp.monthlySales", icon: "🧮", href: "/expenses/admin/monthly-sales", minLevel: "MANAGE" },
    { labelKey: "exp.bankCollections", icon: "🏦", href: "/expenses/admin/bank-collections", minLevel: "MANAGE" },
    { labelKey: "exp.categories", icon: "🏷️", href: "/expenses/admin/categories", minLevel: "MANAGE" },
    { labelKey: "exp.accounts", icon: "💳", href: "/expenses/admin/accounts", minLevel: "MANAGE" },
    { labelKey: "exp.audit", icon: "📜", href: "/expenses/admin/audit", minLevel: "MANAGE" },
  ],
  user_access: [
    { labelKey: "module.user_access.name", icon: "👥", href: "/users" },
  ],
  settings: [
    { labelKey: "settings.appearance.title", icon: "🎨", href: "/settings/appearance", minLevel: "MANAGE" },
    { labelKey: "suppliers.title", icon: "🚚", href: "/settings/logistics", minLevel: "MANAGE" },
  ],
};

export function sectionsFor(moduleKey: string): SectionDef[] {
  return MODULE_SECTIONS[moduleKey] ?? [];
}
