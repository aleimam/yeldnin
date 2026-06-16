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
  pricing: [
    { labelKey: "pricer.supplements", icon: "💊", href: "/pricing/supplements" },
    { labelKey: "pricer.devices", icon: "🩺", href: "/pricing/devices" },
    { labelKey: "pricer.history", icon: "🕐", href: "/pricing/history" },
  ],
  expenses: [
    { labelKey: "exp.dashboard", icon: "📊", href: "/expenses/dashboard" },
    { labelKey: "exp.transactions", icon: "🧾", href: "/expenses/transactions" },
    { labelKey: "exp.reports", icon: "📈", href: "/expenses/reports" },
    { labelKey: "exp.reconciliation", icon: "⚖️", href: "/expenses/reconciliation" },
    { labelKey: "exp.monthlySales", icon: "🧮", href: "/expenses/admin/monthly-sales", minLevel: "MANAGE" },
    { labelKey: "exp.bankCollections", icon: "🏦", href: "/expenses/admin/bank-collections", minLevel: "MANAGE" },
  ],
  user_access: [
    { labelKey: "users.users", icon: "👥", href: "/users" },
    { labelKey: "users.teams", icon: "🤝", href: "/users/teams" },
  ],
  audit_log: [
    { labelKey: "audit.all", icon: "📜", href: "/audit" },
    { labelKey: "module.pricing.name", icon: "🧮", href: "/audit/pricing" },
    { labelKey: "module.expenses.name", icon: "💸", href: "/audit/expenses" },
    { labelKey: "module.user_access.name", icon: "👥", href: "/audit/user_access" },
    { labelKey: "module.settings.name", icon: "⚙️", href: "/audit/settings" },
  ],
};

export function sectionsFor(moduleKey: string): SectionDef[] {
  return MODULE_SECTIONS[moduleKey] ?? [];
}

// ── Settings module: grouped sections. Each group is gated by the OWNING
// module's MANAGE level (Settings unifies the UI, but access stays per-module).
export interface SettingsGroup {
  labelKey: string;
  gateModule: string;
  gateLevel: Level;
  items: SectionDef[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    labelKey: "settings.group.general",
    gateModule: "settings",
    gateLevel: "MANAGE",
    items: [
      { labelKey: "settings.appearance.title", icon: "🎨", href: "/settings/appearance" },
      { labelKey: "pages.title", icon: "📄", href: "/settings/pages" },
    ],
  },
  {
    labelKey: "settings.group.pricing",
    gateModule: "pricing",
    gateLevel: "MANAGE",
    items: [{ labelKey: "pricer.variables", icon: "⚙️", href: "/settings/pricing/variables" }],
  },
  {
    labelKey: "settings.group.expenses",
    gateModule: "expenses",
    gateLevel: "MANAGE",
    items: [
      { labelKey: "exp.categories", icon: "🏷️", href: "/settings/expenses/categories" },
      { labelKey: "exp.accounts", icon: "💳", href: "/settings/expenses/accounts" },
    ],
  },
  {
    // Interim: Suppliers is gated by settings/MANAGE until the real Logistics
    // module exists, at which point this moves to gateModule "logistics".
    labelKey: "settings.group.logistics",
    gateModule: "settings",
    gateLevel: "MANAGE",
    items: [{ labelKey: "suppliers.title", icon: "🚚", href: "/settings/logistics" }],
  },
];

type CanFn = (moduleKey: string, level: Level) => boolean;

export function visibleSettingsGroups(can: CanFn) {
  return SETTINGS_GROUPS.filter((g) => can(g.gateModule, g.gateLevel)).map((g) => ({
    labelKey: g.labelKey,
    items: g.items,
  }));
}

/** Can the user reach the Settings module at all (manages ≥1 settings area)? */
export function canAccessSettings(can: CanFn): boolean {
  return SETTINGS_GROUPS.some((g) => can(g.gateModule, g.gateLevel));
}
