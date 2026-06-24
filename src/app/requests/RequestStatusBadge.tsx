// Pure presentational badge for a request's approval status.
const TONE: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  APPROVED: "bg-green-500/15 text-green-600 border-green-500/30",
  REJECTED: "bg-red-500/15 text-red-600 border-red-500/30",
};

export function RequestStatusBadge({ status, label }: { status: string; label: string }) {
  const tone = TONE[status] ?? "bg-canvas text-muted border-line";
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}
