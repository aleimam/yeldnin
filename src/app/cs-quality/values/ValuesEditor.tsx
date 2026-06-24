"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { CS_LEVELS, type CsConfigShape, type CsLevel } from "@/lib/cs/cs-logic";
import { saveCsConfigAction } from "../actions";

function tone(lvl: string) {
  if (lvl === "CATASTROPHE") return "font-medium text-red-600";
  if (lvl === "OUTSTANDING") return "font-medium text-green-600";
  return "text-ink";
}

export function ValuesEditor({ initial }: { initial: CsConfigShape }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cfg, setCfg] = useState<CsConfigShape>(initial);
  const [saved, setSaved] = useState(false);

  const setVal = (scope: "call" | "performance", level: CsLevel, v: number) => {
    setSaved(false);
    setCfg((p) => ({ ...p, [scope]: { ...p[scope], [level]: v } }));
  };
  const setSplit = (k: "calls" | "performance", v: number) => {
    setSaved(false);
    setCfg((p) => ({ ...p, split: { ...p.split, [k]: v } }));
  };
  const setVetoAllowance = (v: number) => {
    setSaved(false);
    setCfg((p) => ({ ...p, vetoAllowance: v }));
  };

  function save() {
    setSaved(false);
    start(async () => {
      await saveCsConfigAction(cfg);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="card max-w-xl space-y-4 p-5">
      <p className="text-sm text-muted">{t("cs.valuesIntro")}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="th">{t("cs.answer")}</th>
            <th className="th text-end">{t("cs.scope.CALL")}</th>
            <th className="th text-end">{t("cs.scope.PERFORMANCE")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {CS_LEVELS.map((lvl) => (
            <tr key={lvl}>
              <td className="td"><span className={tone(lvl)}>{t(`cs.level.${lvl}`)}</span></td>
              <td className="td text-end"><input type="number" step="0.1" className="input ms-auto w-24 text-end" value={cfg.call[lvl]} onChange={(e) => setVal("call", lvl, Number(e.target.value) || 0)} /></td>
              <td className="td text-end"><input type="number" step="0.1" className="input ms-auto w-24 text-end" value={cfg.performance[lvl]} onChange={(e) => setVal("performance", lvl, Number(e.target.value) || 0)} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-line pt-4">
        <p className="label mb-1">{t("cs.splitTitle")}</p>
        <p className="mb-2 text-xs text-muted">{t("cs.splitHint")}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-ink">{t("cs.scope.CALL")}<input type="number" className="input w-24 text-end" value={cfg.split.calls} onChange={(e) => setSplit("calls", Number(e.target.value) || 0)} />%</label>
          <label className="flex items-center gap-2 text-ink">{t("cs.scope.PERFORMANCE")}<input type="number" className="input w-24 text-end" value={cfg.split.performance} onChange={(e) => setSplit("performance", Number(e.target.value) || 0)} />%</label>
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <p className="label mb-1">{t("cs.veto.allowanceTitle")}</p>
        <p className="mb-2 text-xs text-muted">{t("cs.veto.allowanceHint")}</p>
        <label className="flex items-center gap-2 text-sm text-ink">
          {t("cs.veto.perMonth")}
          <input type="number" min={0} max={99} className="input w-24 text-end" value={cfg.vetoAllowance} onChange={(e) => setVetoAllowance(Number(e.target.value) || 0)} />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">{pending ? "…" : t("common.save")}</button>
        {saved && <span className="text-sm text-green-600">{t("cs.saved")}</span>}
      </div>
    </div>
  );
}
