import type { TFunction } from "@/i18n";

/**
 * Localized label for an expense category name. Resolution order:
 *   1. In Arabic, the admin-entered `nameAr` (looked up by category name via
 *      `arByName`) — covers custom, admin-created categories.
 *   2. The seeded `expcat.<name>` translation key (the default categories) —
 *      the locale-bound `t` already returns the right language.
 *   3. The stored `name` as typed.
 * `arByName` maps category `name` → `nameAr`; pass it (with `locale`) wherever a
 * category name or a transaction's `categoryNameSnapshot` is shown so historical
 * rows localize too. Works on both server and client.
 */
export function categoryLabel(
  t: TFunction,
  name: string,
  locale?: string,
  arByName?: Record<string, string> | Map<string, string>,
): string {
  if (locale === "ar" && arByName) {
    const ar = arByName instanceof Map ? arByName.get(name) : arByName[name];
    if (ar) return ar;
  }
  const key = `expcat.${name}`;
  const label = t(key);
  return label === key ? name : label;
}
