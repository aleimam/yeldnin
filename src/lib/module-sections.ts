import type { Level } from "@/lib/auth/access-logic";

export const SIDEBAR_COOKIE = "yeldnin_sidebar"; // "open" | "collapsed"

// Sidebar sections per module. `labelKey` is an i18n key. A section is hidden
// unless the user passes its gate: `capability` (preferred) checks a named
// capability on the module; otherwise `minLevel` checks the plain level.
export interface SectionDef {
  labelKey: string;
  icon: string;
  href: string;
  minLevel?: Level; // default VIEW
  capability?: string; // capability key on this module (overrides minLevel)
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
    { labelKey: "exp.monthlySales", icon: "🧮", href: "/expenses/admin/monthly-sales", capability: "manageAdmin" },
    { labelKey: "exp.bankCollections", icon: "🏦", href: "/expenses/admin/bank-collections", capability: "manageAdmin" },
  ],
  user_access: [
    { labelKey: "users.users", icon: "👥", href: "/users" },
    { labelKey: "users.teams", icon: "🤝", href: "/users/teams" },
  ],
  // Products are shared master data, surfaced in each operational module that
  // may view/add them (scope-filtered on the page). See products-logic.
  order_requests: [
    { labelKey: "requests.title", icon: "🧾", href: "/requests" },
    { labelKey: "products.title", icon: "📦", href: "/products" },
    { labelKey: "customers.title", icon: "🙋", href: "/customers" },
  ],
  xoonx: [
    { labelKey: "requests.title", icon: "🧾", href: "/requests" },
    { labelKey: "products.title", icon: "📦", href: "/products" },
  ],
  purchasing: [
    { labelKey: "purchasing.pool", icon: "🪣", href: "/purchasing/pool" },
    { labelKey: "purchasing.purchases", icon: "🛒", href: "/purchasing/purchases" },
    { labelKey: "products.title", icon: "📦", href: "/products" },
  ],
  logistics: [
    { labelKey: "patches.title", icon: "📮", href: "/patches" },
    { labelKey: "trip.title", icon: "✈️", href: "/trips" },
    { labelKey: "travelers.title", icon: "🧳", href: "/travelers" },
    { labelKey: "hubs.title", icon: "🏠", href: "/hubs" },
  ],
  operations: [{ labelKey: "shipments.title", icon: "🚢", href: "/shipments" }],
  couriers: [{ labelKey: "couriers.title", icon: "🛵", href: "/couriers" }],
  issues: [{ labelKey: "issues.title", icon: "⚠️", href: "/issues" }],
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

// ── Settings module: grouped sections. Settings unifies the UI, but each item
// is gated by a named capability on its OWNING module (so access still tracks
// the module that owns the data). `adminOnly` items are restricted to admins.
export interface SettingsItem {
  labelKey: string;
  icon: string;
  href: string;
  module: string; // capability owner
  capability: string; // capability key
  adminOnly?: boolean; // gate by admin tier instead of the capability
}
export interface SettingsGroup {
  labelKey: string;
  items: SettingsItem[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    labelKey: "settings.group.general",
    items: [
      { labelKey: "settings.appearance.title", icon: "🎨", href: "/settings/appearance", module: "settings", capability: "manageAppearance" },
      { labelKey: "pages.title", icon: "📄", href: "/settings/pages", module: "settings", capability: "managePages" },
      { labelKey: "perm.title", icon: "🔐", href: "/settings/permissions", module: "settings", capability: "managePermissions", adminOnly: true },
      { labelKey: "workflow.title", icon: "🔄", href: "/settings/workflow", module: "settings", capability: "manageWorkflow", adminOnly: true },
    ],
  },
  {
    labelKey: "settings.group.pricing",
    items: [{ labelKey: "pricer.variables", icon: "⚙️", href: "/settings/pricing/variables", module: "pricing", capability: "editVariables" }],
  },
  {
    labelKey: "settings.group.expenses",
    items: [
      { labelKey: "exp.categories", icon: "🏷️", href: "/settings/expenses/categories", module: "expenses", capability: "manageReference" },
      { labelKey: "exp.accounts", icon: "💳", href: "/settings/expenses/accounts", module: "expenses", capability: "manageReference" },
    ],
  },
  {
    // Interim: Suppliers lives under Settings until the real Logistics module exists.
    labelKey: "settings.group.logistics",
    items: [{ labelKey: "suppliers.title", icon: "🚚", href: "/settings/logistics", module: "settings", capability: "manageModules" }],
  },
];

type CapFn = (moduleKey: string, capability: string) => boolean;

function itemVisible(it: SettingsItem, can: CapFn, isAdmin: boolean): boolean {
  return it.adminOnly ? isAdmin : can(it.module, it.capability);
}

export function visibleSettingsGroups(can: CapFn, isAdmin: boolean) {
  return SETTINGS_GROUPS.map((g) => ({
    labelKey: g.labelKey,
    items: g.items.filter((it) => itemVisible(it, can, isAdmin)),
  })).filter((g) => g.items.length > 0);
}

/** Can the user reach the Settings module at all (≥1 visible settings item)? */
export function canAccessSettings(can: CapFn, isAdmin: boolean): boolean {
  return SETTINGS_GROUPS.some((g) => g.items.some((it) => itemVisible(it, can, isAdmin)));
}
