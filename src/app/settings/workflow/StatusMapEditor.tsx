"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import {
  resolveWorkflow,
  type ItemStatus,
  type TimerRange,
  type WorkflowOverrides,
} from "@/lib/workflow/workflow-logic";
import { saveWorkflowAction, resetWorkflowAction } from "./actions";

export interface StatusRow {
  key: ItemStatus;
  defaultEn: string;
  defaultAr: string;
  en: string;
  ar: string;
  hideNormal: boolean;
  hideSpecial: boolean;
  containers: string;
}
type Timers = { TRANSIT: TimerRange; GLOBAL_SHIPPING: TimerRange };

export function StatusMapEditor({
  rows,
  timers: initialTimers,
}: {
  rows: StatusRow[];
  timers: Timers;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const [labels, setLabels] = useState<Record<string, { en: string; ar: string }>>(
    Object.fromEntries(rows.map((r) => [r.key, { en: r.en, ar: r.ar }])),
  );
  const [hideNormal, setHideNormal] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.key, r.hideNormal])),
  );
  const [hideSpecial, setHideSpecial] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.key, r.hideSpecial])),
  );
  const [timers, setTimers] = useState<Timers>(initialTimers);

  const dirty = () => setSaved(false);
  const setLabel = (k: string, f: "en" | "ar", v: string) => {
    setLabels((p) => ({ ...p, [k]: { ...p[k], [f]: v } }));
    dirty();
  };
  const setTimer = (which: keyof Timers, b: "min" | "max", v: number) => {
    setTimers((p) => ({ ...p, [which]: { ...p[which], [b]: v } }));
    dirty();
  };

  const overrides = useMemo<WorkflowOverrides>(
    () => ({
      labels: Object.fromEntries(rows.map((r) => [r.key, labels[r.key]])),
      carryForward: {
        SALES_NORMAL: rows.filter((r) => hideNormal[r.key]).map((r) => r.key),
        SALES_SPECIAL: rows.filter((r) => hideSpecial[r.key]).map((r) => r.key),
      },
      timers,
    }),
    [rows, labels, hideNormal, hideSpecial, timers],
  );

  // Live preview of what Sales sees (applies edited labels + carry-forward).
  const preview = useMemo(() => resolveWorkflow(overrides), [overrides]);

  function save() {
    start(async () => {
      await saveWorkflowAction(overrides);
      setSaved(true);
      router.refresh();
    });
  }
  function reset() {
    if (!confirm(t("workflow.resetConfirm"))) return;
    start(async () => {
      await resetWorkflowAction();
      // Full reload so the editor re-mounts with the restored defaults
      // (controlled state isn't re-initialised by router.refresh alone).
      window.location.reload();
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-green-600">{t("workflow.saved")}</span>}
        <button onClick={reset} disabled={pending} className="text-xs text-muted hover:text-ink disabled:opacity-50">
          {t("workflow.reset")}
        </button>
        <button onClick={save} disabled={pending} className="btn-primary px-3 py-1.5 text-sm">
          {pending ? "…" : t("common.save")}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-cards>
          <thead>
            <tr className="border-b border-line text-start">
              <th className="th">{t("workflow.status")}</th>
              <th className="th">{t("workflow.labelEn")}</th>
              <th className="th">{t("workflow.labelAr")}</th>
              <th className="th text-center">{t("workflow.carryNormal")}</th>
              <th className="th text-center">{t("workflow.carrySpecial")}</th>
              <th className="th">{t("workflow.salesPreview")}</th>
              <th className="th">{t("workflow.containers")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="td font-mono text-[11px] text-muted" data-label={t("workflow.status")}>{r.key}</td>
                <td className="td" data-label={t("workflow.labelEn")}>
                  <input className="input h-8 py-1" value={labels[r.key].en} onChange={(e) => setLabel(r.key, "en", e.target.value)} />
                </td>
                <td className="td" data-label={t("workflow.labelAr")}>
                  <input className="input h-8 py-1" dir="rtl" value={labels[r.key].ar} onChange={(e) => setLabel(r.key, "ar", e.target.value)} />
                </td>
                <td className="td text-center sm:text-center" data-label={t("workflow.carryNormal")}>
                  <input
                    type="checkbox"
                    checked={hideNormal[r.key]}
                    onChange={(e) => { setHideNormal((p) => ({ ...p, [r.key]: e.target.checked })); dirty(); }}
                  />
                </td>
                <td className="td text-center sm:text-center" data-label={t("workflow.carrySpecial")}>
                  <input
                    type="checkbox"
                    checked={hideSpecial[r.key]}
                    onChange={(e) => { setHideSpecial((p) => ({ ...p, [r.key]: e.target.checked })); dirty(); }}
                  />
                </td>
                <td className="td text-xs text-muted" data-label={t("workflow.salesPreview")}>
                  <span title="normal">{preview.salesLabel(r.key, false, "en")}</span>
                  {" · "}
                  <span title="special">{preview.salesLabel(r.key, true, "en")}</span>
                </td>
                <td className="td text-xs text-muted" data-label={t("workflow.containers")}>{r.containers || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-ink">{t("workflow.timers")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["TRANSIT", "GLOBAL_SHIPPING"] as const).map((which) => (
            <div key={which} className="flex items-center gap-3 rounded-lg border border-line p-3">
              <span className="flex-1 text-sm text-ink">
                {which === "TRANSIT" ? t("workflow.transit") : t("workflow.globalShipping")}
              </span>
              <label className="text-xs text-muted">{t("workflow.min")}</label>
              <input
                type="number" min={0}
                className="input h-8 w-16 py-1"
                value={timers[which].min}
                onChange={(e) => setTimer(which, "min", Number(e.target.value))}
              />
              <label className="text-xs text-muted">{t("workflow.max")}</label>
              <input
                type="number" min={0}
                className="input h-8 w-16 py-1"
                value={timers[which].max}
                onChange={(e) => setTimer(which, "max", Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
