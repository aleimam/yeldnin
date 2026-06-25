// Pure presentational badge for a document's publish status.
const TONE: Record<string, string> = {
  PUBLISHED: "bg-green-500/15 text-green-600 border-green-500/30",
  DRAFT: "bg-amber-500/15 text-amber-600 border-amber-500/30",
};

export function DocStatusBadge({ status, label }: { status: string; label: string }) {
  const tone = TONE[status] ?? "bg-canvas text-muted border-line";
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}
