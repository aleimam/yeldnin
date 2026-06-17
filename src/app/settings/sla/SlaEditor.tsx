"use client";

import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { saveSlaAction } from "./actions";
import type { SlaSettings, ScopeGrace } from "@/lib/sla/sla-logic";

const CLASSES: { key: keyof ScopeGrace; labelKey: string }[] = [
  { key: "injection", labelKey: "sla.injection" },
  { key: "standard", labelKey: "sla.standard" },
  { key: "fast", labelKey: "sla.fast" },
];

export function SlaEditor({ initial }: { initial: SlaSettings }) {
  const t = useT();
  const [sla, setSla] = useState<SlaSettings>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const setGrace = (scope: "egv" | "xoonx", key: keyof ScopeGrace, v: number) => {
    setSaved(false);
    setSla((p) => ({ ...p, [scope]: { ...p[scope], [key]: Math.max(0, v) } }));
  };

  const save = () =>
    start(async () => {
      await saveSlaAction(sla);
      setSaved(true);
    });

  // Render helper (not a component) so inputs keep focus across re-renders.
  const scopeBlock = (scope: "egv" | "xoonx", title: string) => (
    <div className="rounded-lg border border-line p-4">
      <h3 className="mb-3 font-semibold text-ink">{title}</h3>
      <div className="grid grid-cols-3 gap-3">
        {CLASSES.map((c) => (
          <label key={c.key} className="block">
            <span className="label">{t(c.labelKey)}</span>
            <input
              type="number"
              min={0}
              className="input"
              value={sla[scope][c.key]}
              onChange={(e) => setGrace(scope, c.key, Number(e.target.value) || 0)}
            />
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="card space-y-5 p-6">
      <p className="text-sm text-muted">{t("sla.desc")}</p>
      {scopeBlock("egv", t("sla.egv"))}
      {scopeBlock("xoonx", t("sla.xoonx"))}
      <div className="max-w-xs">
        <label className="block">
          <span className="label">{t("sla.riskWindow")}</span>
          <input
            type="number"
            min={0}
            className="input"
            value={sla.riskWindowDays}
            onChange={(e) => {
              setSaved(false);
              setSla((p) => ({ ...p, riskWindowDays: Math.max(0, Number(e.target.value) || 0) }));
            }}
          />
        </label>
      </div>
      <div className="max-w-xs">
        <label className="block">
          <span className="label">{t("sla.depositPct")}</span>
          <input
            type="number"
            min={0}
            className="input"
            value={sla.depositPct}
            onChange={(e) => {
              setSaved(false);
              setSla((p) => ({ ...p, depositPct: Math.max(0, Number(e.target.value) || 0) }));
            }}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">
          {t("sla.save")}
        </button>
        {saved && <span className="text-sm text-emerald-600">{t("sla.saved")}</span>}
      </div>
    </div>
  );
}
