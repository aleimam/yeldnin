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
  module?: string; // owning module for the gate (default: the sidebar's moduleKey)
  shortcut?: boolean; // a cross-link to another module's section (visual hint)
  adminOnly?: boolean; // gate by admin tier (for admin-only pages surfaced in a module sidebar)
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
    { labelKey: "requests.title", icon: "🧾", href: "/requests?m=xoonx" },
    { labelKey: "products.title", icon: "📦", href: "/products?m=xoonx" },
    { labelKey: "customers.title", icon: "🙋", href: "/customers?m=xoonx" },
    { labelKey: "xoonx.expenses", icon: "💵", href: "/xoonx/expenses" },
    { labelKey: "xoonx.reports", icon: "📈", href: "/xoonx/reports", capability: "viewReports" },
  ],
  // Logistics holds the merged Purchasing + Logistics nav. Pool/Purchases are
  // gated by the (separate) `purchasing` permission; Patches…Hubs by `logistics`.
  // Products is a shortcut to the Sales-owned shared catalog (purchasing folks).
  logistics: [
    { labelKey: "requests.title", icon: "🧾", href: "/requests?m=logistics" },
    { labelKey: "purchasing.toBuy", icon: "🪣", href: "/purchasing/pool", module: "purchasing" },
    { labelKey: "purchasing.purchases", icon: "🛒", href: "/purchasing/purchases", module: "purchasing" },
    { labelKey: "patches.title", icon: "📮", href: "/patches" },
    { labelKey: "trip.title", icon: "✈️", href: "/trips" },
    { labelKey: "travelers.title", icon: "🧳", href: "/travelers" },
    { labelKey: "hubs.title", icon: "🏠", href: "/hubs" },
    { labelKey: "transfers.title", icon: "🔀", href: "/transfers" },
    { labelKey: "carriers.title", icon: "🚛", href: "/carriers" },
    { labelKey: "exceptions.title", icon: "🚩", href: "/exceptions", capability: "operate" },
    { labelKey: "products.title", icon: "📦", href: "/products", module: "purchasing", shortcut: true },
  ],
  operations: [{ labelKey: "shipments.title", icon: "🚢", href: "/shipments" }],
  // 360 Reviews. Everyone reaches the module (VIEW = self-service); the criteria
  // & pillars editor is admin/HR only (capability "manage").
  evaluation: [
    { labelKey: "eval.myReviews", icon: "📝", href: "/evaluation" },
    { labelKey: "eval.criteria", icon: "📋", href: "/evaluation/criteria", capability: "manage" },
  ],
  human_resources: [
    { labelKey: "hr.employees", icon: "👥", href: "/hr/employees" },
    { labelKey: "hr.hierarchy", icon: "🪜", href: "/hr/hierarchy" },
    { labelKey: "hr.attendance", icon: "🗓️", href: "/hr/attendance" },
    { labelKey: "leave.myLeave", icon: "🌴", href: "/hr/my-leave" },
    { labelKey: "salary.mySalary", icon: "💵", href: "/hr/my-salary" },
    { labelKey: "eng.myTitle", icon: "🎯", href: "/hr/my-engagement" },
    { labelKey: "eng.title", icon: "🎉", href: "/hr/engagement", capability: "manage" },
    { labelKey: "pay.title", icon: "💰", href: "/hr/payroll", capability: "manage" },
    { labelKey: "an.title", icon: "📊", href: "/hr/analytics", capability: "manage" },
    { labelKey: "pos.title", icon: "🗂️", href: "/hr/positions", capability: "manage" },
    { labelKey: "hr.setup", icon: "⚙️", href: "/hr/setup", capability: "manage" },
  ],
  // Module KEY stays `couriers` (permissions are keyed by it — renaming would
  // void every grant); the module is LABELLED "Deliveries" and the courier
  // roster becomes a tab inside it. See INTEGRATION_V2_DELIVERIES.md §10.
  couriers: [
    { labelKey: "dlv.title", icon: "📦", href: "/deliveries" },
    { labelKey: "couriers.title", icon: "🛵", href: "/couriers" },
  ],
  issues: [{ labelKey: "issues.title", icon: "⚠️", href: "/issues" }],
  history: [{ labelKey: "history.title", icon: "🕐", href: "/history" }],
  documents: [
    { labelKey: "docs.all", icon: "📄", href: "/documents" },
    { labelKey: "docs.letterhead.nav", icon: "📰", href: "/documents/letterhead", adminOnly: true },
    { labelKey: "docs.categories", icon: "🏷️", href: "/documents/categories", adminOnly: true },
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
      { labelKey: "notifyrules.title", icon: "🔔", href: "/settings/notifications", module: "settings", capability: "manageModules", adminOnly: true },
      { labelKey: "notifysend.title", icon: "📣", href: "/settings/notifications/send", module: "settings", capability: "sendNotifications" },
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
    items: [
      { labelKey: "suppliers.title", icon: "🚚", href: "/settings/logistics", module: "settings", capability: "manageModules" },
      { labelKey: "countries.title", icon: "🌍", href: "/settings/countries", module: "settings", capability: "manageModules" },
      { labelKey: "sla.title", icon: "⏱️", href: "/settings/sla", module: "settings", capability: "manageModules", adminOnly: true },
    ],
  },
  {
    labelKey: "settings.group.xoonx",
    items: [{ labelKey: "settings.xoonx", icon: "🌐", href: "/settings/xoonx", module: "settings", capability: "manageModules", adminOnly: true }],
  },
  {
    labelKey: "settings.group.integrations",
    items: [{ labelKey: "integ.title", icon: "🔌", href: "/settings/integrations", module: "settings", capability: "manageModules", adminOnly: true }],
  },
  {
    labelKey: "settings.group.system",
    items: [{ labelKey: "backup.title", icon: "🗄️", href: "/settings/backup", module: "settings", capability: "manageModules", adminOnly: true }],
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
