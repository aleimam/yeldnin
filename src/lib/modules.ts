// Static module registry — mirrors the `Module` table and the v1.28 dashboard.
// `key` matches i18n keys (module.<key>.name / .desc) and permission prefixes.

export type ModuleSection = "main" | "admin";

export interface ModuleDef {
  key: string;
  route: string;
  section: ModuleSection;
  /** Emoji placeholder icon (refined against the live app later). */
  icon: string;
}

export const MODULES: ModuleDef[] = [
  { key: "egv_pricer", route: "/pricer", section: "main", icon: "🧮" },
  { key: "expenses", route: "/expenses", section: "main", icon: "💸" },
  { key: "order_requests", route: "/sales", section: "main", icon: "🧾" },
  { key: "xoonx", route: "/xoonx", section: "main", icon: "🌐" },
  { key: "purchasing", route: "/purchasing", section: "main", icon: "🛒" },
  { key: "logistics", route: "/logistics", section: "main", icon: "🚚" },
  { key: "operations", route: "/operations", section: "main", icon: "💼" },
  { key: "couriers", route: "/couriers", section: "main", icon: "🛵" },
  { key: "issues", route: "/issues", section: "main", icon: "⚠️" },
  { key: "history", route: "/history", section: "main", icon: "🕐" },
  { key: "settings", route: "/settings", section: "admin", icon: "⚙️" },
  { key: "user_access", route: "/users", section: "admin", icon: "👥" },
  { key: "audit_log", route: "/audit", section: "admin", icon: "📜" },
];

export const MAIN_MODULES = MODULES.filter((m) => m.section === "main");
export const ADMIN_MODULES = MODULES.filter((m) => m.section === "admin");
