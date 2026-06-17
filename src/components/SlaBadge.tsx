import type { SlaStatus } from "@/lib/sla/sla-logic";

const CLS: Record<SlaStatus, string> = {
  HEALTHY: "bg-emerald-100 text-emerald-700",
  RISK: "bg-amber-100 text-amber-700",
  DELAYED: "bg-red-100 text-red-700",
  DELIVERED: "bg-slate-100 text-slate-600",
};

/** Small colored chip for a Healthy/Risk/Delayed/Delivered SLA status. */
export function SlaBadge({ status, label }: { status: SlaStatus; label: string }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${CLS[status]}`}>{label}</span>
  );
}
