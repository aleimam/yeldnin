"use client";
import { useT } from "@/i18n/client";

export interface PayLine {
  id: number;
  kind: string;
  source: string;
  label: string;
  amount: number;
  detail: string | null;
}
export interface PaySlip {
  id: number;
  year: number;
  month: number;
  status: string;
  earningsTotal: number;
  bonusTotal: number;
  penaltyTotal: number;
  gross: number;
  net: number;
  workingDays: number;
  dayOfBasic: number;
  dayOfTotal: number;
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sourceKey: Record<string, string> = { STRUCTURE: "pay.src.structure", DUTY: "pay.src.duty", TARGET: "pay.src.target", ABSENCE: "pay.src.absence", ADHOC: "pay.src.adhoc" };

export function PayslipBreakdown({ slip, lines, onRemove, pending }: { slip: PaySlip; lines: PayLine[]; onRemove?: (lineId: number) => void; pending?: boolean }) {
  const t = useT();
  const group = (kind: string) => lines.filter((l) => l.kind === kind);
  const monthLabel = `${slip.year}-${String(slip.month).padStart(2, "0")}`;
  const negative = slip.net <= 0 && slip.penaltyTotal > slip.gross;

  const Row = ({ l, sign }: { l: PayLine; sign: string }) => (
    <li className="flex items-baseline justify-between gap-2 py-1">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-ink">{l.label}</span>
        <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t(sourceKey[l.source] ?? "pay.src.adhoc")}</span>
        {l.detail && <span className="text-xs text-muted">{l.detail}</span>}
        {onRemove && (l.source === "TARGET" || l.source === "ADHOC") && (
          <button type="button" className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => onRemove(l.id)}>✕</button>
        )}
      </span>
      <span className={`whitespace-nowrap font-medium ${sign === "-" ? "text-red-600" : "text-ink"}`}>{sign}{fmt(l.amount)}</span>
    </li>
  );

  const Section = ({ kind, titleKey, sign }: { kind: string; titleKey: string; sign: string }) => {
    const g = group(kind);
    if (!g.length) return null;
    return (
      <div>
        <div className="label">{t(titleKey)}</div>
        <ul className="divide-y divide-line/50 text-sm">{g.map((l) => <Row key={l.id} l={l} sign={sign} />)}</ul>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{monthLabel}</span>
        <span className={`rounded px-2 py-0.5 text-[11px] ${slip.status === "LOCKED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{t(`pay.status.${slip.status}`)}</span>
      </div>
      <Section kind="EARNING" titleKey="comp.earning" sign="" />
      <Section kind="BONUS" titleKey="pay.bonuses" sign="" />
      <Section kind="PENALTY" titleKey="pay.penalties" sign="-" />
      <div className="space-y-0.5 border-t border-line pt-2 text-sm">
        <div className="flex justify-between text-muted"><span>{t("pay.gross")}</span><span>{fmt(slip.gross)}</span></div>
        {slip.penaltyTotal > 0 && <div className="flex justify-between text-muted"><span>{t("pay.deductions")}</span><span className="text-red-600">-{fmt(slip.penaltyTotal)}</span></div>}
        <div className="flex justify-between text-base font-semibold text-ink"><span>{t("pay.net")}</span><span>{fmt(slip.net)}</span></div>
        {negative && <p className="text-xs text-red-600">{t("pay.negativeNote")}</p>}
      </div>
      <p className="text-[11px] text-muted">{t("pay.workingDays")}: {slip.workingDays} · {t("pay.dayOfBasic")}: {fmt(slip.dayOfBasic)} · {t("pay.dayOfTotal")}: {fmt(slip.dayOfTotal)}</p>
    </div>
  );
}
