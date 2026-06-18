// Pure capability catalog + resolution — no DB, no I/O. Unit-tested.
//
// A "capability" is a named action within a module (e.g. permanently delete a
// pricing calculation). Each capability has a DEFAULT minimum level that
// reproduces the behavior hard-coded before Phase B. Admins can override the
// minimum level per capability; overrides are stored in the DB and merged on
// top of these defaults at read time. Access = user's effective module level
// meets the (possibly overridden) minimum for the capability.

import { isLevel, type Level } from "./access-logic";

export interface Capability {
  key: string; // unique within its module, e.g. "deleteAny"
  module: string; // owning module key
  labelKey: string; // i18n key for the human label
  /** Minimum level that grants this capability by default. */
  defaultLevel: Level;
}

/** Module keys that expose configurable capabilities (order = editor order). */
export const CAPABILITY_MODULES = ["pricing", "expenses", "user_access", "settings", "purchasing", "logistics", "operations", "couriers", "issues"] as const;

// NOTE: opening a module at all stays governed by the plain VIEW gate
// (canModule(key, "VIEW")). Capabilities govern ACTIONS within a module.
export const CAPABILITIES: Capability[] = [
  // ── Pricing ──────────────────────────────────────────────────────────────
  { key: "calculate", module: "pricing", labelKey: "cap.pricing.calculate", defaultLevel: "OPERATE" },
  { key: "deleteOwn", module: "pricing", labelKey: "cap.pricing.deleteOwn", defaultLevel: "OPERATE" },
  { key: "deleteAny", module: "pricing", labelKey: "cap.pricing.deleteAny", defaultLevel: "MANAGE" },
  { key: "editVariables", module: "pricing", labelKey: "cap.pricing.editVariables", defaultLevel: "MANAGE" },

  // ── Expenses ─────────────────────────────────────────────────────────────
  { key: "createTxn", module: "expenses", labelKey: "cap.expenses.createTxn", defaultLevel: "OPERATE" },
  { key: "editOwn", module: "expenses", labelKey: "cap.expenses.editOwn", defaultLevel: "OPERATE" },
  { key: "editAny", module: "expenses", labelKey: "cap.expenses.editAny", defaultLevel: "MANAGE" },
  { key: "deleteTxn", module: "expenses", labelKey: "cap.expenses.deleteTxn", defaultLevel: "MANAGE" },
  { key: "manageReference", module: "expenses", labelKey: "cap.expenses.manageReference", defaultLevel: "MANAGE" },
  { key: "manageAdmin", module: "expenses", labelKey: "cap.expenses.manageAdmin", defaultLevel: "MANAGE" },

  // ── Users & access ─────────────────────────────────────────────────────
  { key: "manageUsers", module: "user_access", labelKey: "cap.users.manageUsers", defaultLevel: "MANAGE" },
  { key: "manageTeams", module: "user_access", labelKey: "cap.users.manageTeams", defaultLevel: "MANAGE" },

  // ── Settings ───────────────────────────────────────────────────────────────
  { key: "manageAppearance", module: "settings", labelKey: "cap.settings.manageAppearance", defaultLevel: "MANAGE" },
  { key: "managePages", module: "settings", labelKey: "cap.settings.managePages", defaultLevel: "MANAGE" },
  { key: "manageModules", module: "settings", labelKey: "cap.settings.manageModules", defaultLevel: "MANAGE" },
  // The permissions editor itself is additionally restricted to admin tiers in
  // code; this entry only documents/labels it. Default MANAGE.
  { key: "managePermissions", module: "settings", labelKey: "cap.settings.managePermissions", defaultLevel: "MANAGE" },
  { key: "manageWorkflow", module: "settings", labelKey: "cap.settings.manageWorkflow", defaultLevel: "MANAGE" },

  // ── Purchasing ───────────────────────────────────────────────────────────
  { key: "operate", module: "purchasing", labelKey: "cap.purchasing.operate", defaultLevel: "OPERATE" },

  // ── Logistics ────────────────────────────────────────────────────────────
  { key: "operate", module: "logistics", labelKey: "cap.logistics.operate", defaultLevel: "OPERATE" },

  // ── Operations ───────────────────────────────────────────────────────────
  { key: "operate", module: "operations", labelKey: "cap.operations.operate", defaultLevel: "OPERATE" },

  // ── Couriers ─────────────────────────────────────────────────────────────
  { key: "operate", module: "couriers", labelKey: "cap.couriers.operate", defaultLevel: "OPERATE" },

  // ── Issues ───────────────────────────────────────────────────────────────
  { key: "operate", module: "issues", labelKey: "cap.issues.operate", defaultLevel: "OPERATE" },
];

/** Partial override map: { [moduleKey]: { [capabilityKey]: Level } }. */
export type PolicyOverrides = Record<string, Record<string, Level>>;

const BY_MODULE_KEY = new Map<string, Capability>();
for (const c of CAPABILITIES) BY_MODULE_KEY.set(`${c.module}.${c.key}`, c);

/** Look up a capability definition (or undefined). */
export function getCapability(moduleKey: string, capabilityKey: string): Capability | undefined {
  return BY_MODULE_KEY.get(`${moduleKey}.${capabilityKey}`);
}

/** All capabilities of a module, in catalog order. */
export function capabilitiesForModule(moduleKey: string): Capability[] {
  return CAPABILITIES.filter((c) => c.module === moduleKey);
}

/**
 * The minimum level required for a capability, honoring admin overrides.
 * Unknown capabilities resolve to MANAGE (fail-safe: most restrictive).
 */
export function resolveCapabilityLevel(
  overrides: PolicyOverrides | null | undefined,
  moduleKey: string,
  capabilityKey: string,
): Level {
  const override = overrides?.[moduleKey]?.[capabilityKey];
  if (isLevel(override)) return override;
  return getCapability(moduleKey, capabilityKey)?.defaultLevel ?? "MANAGE";
}

/** Full default policy as a nested map (used by the editor + reset). */
export function defaultPolicy(): PolicyOverrides {
  const out: PolicyOverrides = {};
  for (const c of CAPABILITIES) {
    (out[c.module] ??= {})[c.key] = c.defaultLevel;
  }
  return out;
}
