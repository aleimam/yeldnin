// Pure badge for a veto's outcome: PENDING (awaiting admin) / REJECTED (eval
// kept) / UPHELD (eval deleted).
const TONE: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  REJECTED: "bg-canvas text-muted border-line",
  UPHELD: "bg-green-500/15 text-green-600 border-green-500/30",
};

export function VetoStatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[status] ?? "bg-canvas text-muted border-line"}`}>{label}</span>;
}
