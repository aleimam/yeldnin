import type { TFunction } from "@/i18n";

/**
 * Localized label for an expense category name. Seeded default categories have
 * an `expcat.<name>` translation key; custom (admin-created) names have no key
 * and fall back to the stored name as typed. Works on both server and client.
 */
export function categoryLabel(t: TFunction, name: string): string {
  const key = `expcat.${name}`;
  const label = t(key);
  return label === key ? name : label;
}
