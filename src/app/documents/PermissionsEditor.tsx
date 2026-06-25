"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { GRANT_LEVELS } from "@/lib/documents/documents-logic";
import { setDocumentPermissionsAction } from "./actions";

type Level = "NONE" | "VIEW" | "OPERATE" | "MANAGE";

/** Per-team access grants for a document. "NONE" rows are dropped on save. */
export function PermissionsEditor({
  documentId,
  teams,
  current,
}: {
  documentId: number;
  teams: { key: string; name: string }[];
  current: { teamKey: string; level: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const initial: Record<string, Level> = {};
  for (const c of current) initial[c.teamKey] = c.level as Level;
  const [levels, setLevels] = useState<Record<string, Level>>(initial);

  const set = (key: string, level: Level) => {
    setSaved(false);
    setLevels((p) => ({ ...p, [key]: level }));
  };

  function save() {
    setSaved(false);
    const perms = teams
      .map((tm) => ({ teamKey: tm.key, level: levels[tm.key] ?? "NONE" }))
      .filter((p) => p.level !== "NONE");
    start(async () => {
      await setDocumentPermissionsAction(documentId, perms);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("docs.permissions")}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="th">{t("docs.perm.team")}</th>
            <th className="th">{t("docs.perm.level")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {teams.map((tm) => (
            <tr key={tm.key}>
              <td className="td">{tm.name}</td>
              <td className="td">
                <select className="input" value={levels[tm.key] ?? "NONE"} onChange={(e) => set(tm.key, e.target.value as Level)}>
                  <option value="NONE">{t("docs.perm.none")}</option>
                  {GRANT_LEVELS.map((l) => <option key={l} value={l}>{t(`docs.perm.${l.toLowerCase()}`)}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">{t("docs.perm.hint")}</p>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">{pending ? "…" : t("docs.perm.save")}</button>
        {saved && <span className="text-sm text-green-600">{t("docs.perm.saved")}</span>}
      </div>
    </div>
  );
}
