import { CATEGORY_BUCKETS, type CategoryCounts } from "@/lib/items/items-logic";

/**
 * Inline category summary for a container, e.g. "8 items · 3 Injection · 2 Devices".
 * Zero buckets are omitted; an all-zero container renders an em dash. `labels`
 * comes from `categoryLabels(t)` (resolved once per page).
 */
export function ItemCounts({
  counts,
  labels,
  className = "",
}: {
  counts: CategoryCounts;
  labels: Record<string, string>;
  className?: string;
}) {
  const parts = CATEGORY_BUCKETS.filter((b) => counts[b] > 0).map((b) => `${counts[b]} ${labels[b]}`);
  if (!parts.length) return <span className="text-muted">—</span>;
  return <span className={`text-xs text-muted ${className}`}>{parts.join(" · ")}</span>;
}
