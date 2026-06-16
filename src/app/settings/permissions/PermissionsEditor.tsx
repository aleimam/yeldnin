"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { setModulePolicyAction, resetModulePolicyAction } from "./actions";

const LEVELS = ["VIEW", "OPERATE", "MANAGE"] as const;

export interface EditorModule {
  key: string;
  name: string;
  capabilities: { key: string; label: string; level: string; defaultLevel: string }[];
}

export function PermissionsEditor({ module: m }: { module: EditorModule }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [levels, setLevels] = useState<Record<string, string>>(
    Object.fromEntries(m.capabilities.map((c) => [c.key, c.level])),
  );
  const set = (k: string, v: string) => {
    setLevels((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  function save() {
    start(async () => {
      await setModulePolicyAction(m.key, levels);
      setSaved(true);
      router.refresh();
    });
  }
  function reset() {
    if (!confirm(t("perm.resetConfirm"))) return;
    start(async () => {
      await resetModulePolicyAction(m.key);
      router.refresh();
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="font-semibold text-ink">{m.name}</h2>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-600">{t("perm.saved")}</span>}
          <button onClick={reset} disabled={pending} className="text-xs text-muted hover:text-ink disabled:opacity-50">
            {t("perm.reset")}
          </button>
          <button onClick={save} disabled={pending} className="btn-primary px-3 py-1.5 text-sm">
            {pending ? "…" : t("common.save")}
          </button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="th">{t("perm.action")}</th>
            <th className="th">{t("perm.minLevel")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {m.capabilities.map((c) => (
            <tr key={c.key}>
              <td className="td">{c.label}</td>
              <td className="td">
                <div className="flex items-center gap-2">
                  <select
                    className="input max-w-[11rem]"
                    value={levels[c.key]}
                    onChange={(e) => set(c.key, e.target.value)}
                  >
                    {LEVELS.map((lv) => (
                      <option key={lv} value={lv}>
                        {t(`perm.level.${lv.toLowerCase()}`)}
                      </option>
                    ))}
                  </select>
                  {levels[c.key] !== c.defaultLevel && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                      {t("perm.changed")}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
