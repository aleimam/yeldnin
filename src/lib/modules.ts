// Static module registry — mirrors the `Module` table and the v1.28 dashboard.
// `key` matches i18n keys (module.<key>.name / .desc) and permission prefixes.

export type ModuleSection = "main" | "admin";

/** Dashboard / switcher grouping. */
export type ModuleCategory = "supply_chain" | "services" | "people" | "finance" | "administration";

/** Display order of the category groups on the dashboard + switcher. */
export const MODULE_CATEGORIES: ModuleCategory[] = ["supply_chain", "services", "people", "finance", "administration"];

export interface ModuleDef {
  key: string;
  route: string;
  section: ModuleSection;
  /** Which dashboard section this module lives under. */
  category: ModuleCategory;
  /** Emoji placeholder icon (refined against the live app later). */
  icon: string;
  /**
   * If set, this module is folded into another module's navigation: it keeps its
   * own permission key (still grantable per-user, still gates its pages), but is
   * hidden from the top nav (switcher + dashboard) and its sections live under
   * the parent's sidebar. Tab title / sidebar resolve to the parent.
   */
  foldedInto?: string;
}

export const MODULES: ModuleDef[] = [
  { key: "order_requests", route: "/sales", section: "main", category: "supply_chain", icon: "🧾" },
  { key: "xoonx", route: "/xoonx", section: "main", category: "supply_chain", icon: "🌐" },
  // Purchasing is folded into Logistics: one "Logistics" nav holds both, but the
  // purchasing permission stays separate (granted independently; gates its pages).
  { key: "purchasing", route: "/purchasing", section: "main", category: "supply_chain", icon: "🛒", foldedInto: "logistics" },
  { key: "logistics", route: "/logistics", section: "main", category: "supply_chain", icon: "🚚" },
  { key: "operations", route: "/operations", section: "main", category: "supply_chain", icon: "💼" },
  { key: "couriers", route: "/deliveries", section: "main", category: "supply_chain", icon: "🛵" },
  { key: "issues", route: "/issues", section: "main", category: "supply_chain", icon: "⚠️" },
  { key: "history", route: "/history", section: "main", category: "supply_chain", icon: "🕐" },
  { key: "pricing", route: "/pricing", section: "main", category: "services", icon: "🧮" },
  { key: "cs_quality", route: "/cs-quality", section: "main", category: "people", icon: "🎧" },
  { key: "human_resources", route: "/hr", section: "main", category: "people", icon: "👤" },
  { key: "expenses", route: "/expenses", section: "main", category: "finance", icon: "💸" },
  { key: "settings", route: "/settings", section: "admin", category: "administration", icon: "⚙️" },
  { key: "user_access", route: "/users", section: "admin", category: "administration", icon: "👥" },
  { key: "audit_log", route: "/audit", section: "admin", category: "administration", icon: "📜" },
  { key: "error_log", route: "/error-log", section: "admin", category: "administration", icon: "🐞" },
  { key: "documents", route: "/documents", section: "admin", category: "administration", icon: "📄" },
];

export const MAIN_MODULES = MODULES.filter((m) => m.section === "main");
export const ADMIN_MODULES = MODULES.filter((m) => m.section === "admin");

/** Keys of modules folded into `parentKey` (their permissions also reach the parent's nav). */
export function childModules(parentKey: string): string[] {
  return MODULES.filter((m) => m.foldedInto === parentKey).map((m) => m.key);
}
