"use client";
import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { LEVELS, type Level } from "@/lib/auth/access-logic";
import { saveAccessAction } from "../actions";
import { ModuleGlyph } from "@/components/shell/ModuleGlyph";

export interface TeamOpt { key: string; name: string }
export interface ModuleOpt { key: string; name: string; icon: string }

export function AccessForm({
  userId,
  teams,
  modules,
  initialTeamKeys,
  initialLevels,
  isAdminTier,
}: {
  userId: number;
  teams: TeamOpt[];
  modules: ModuleOpt[];
  initialTeamKeys: string[];
  initialLevels: Record<string, Level>;
  isAdminTier: boolean;
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [teamKeys, setTeamKeys] = useState<Set<string>>(new Set(initialTeamKeys));
  const [levels, setLevels] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const mod of modules) m[mod.key] = initialLevels[mod.key] ?? "NONE";
    return m;
  });

  const toggleTeam = (key: string) =>
    setTeamKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  function submit() {
    setSaved(false);
    start(async () => {
      await saveAccessAction({ userId, teamKeys: [...teamKeys], levels });
      setSaved(true);
    });
  }

  return (
    <div className="card space-y-6 p-6">
      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("common.saveAll")} ✓
        </div>
      )}

      <div>
        <h2 className="font-semibold text-ink">{t("users.teams")}</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {teams.map((team) => (
            <label key={team.key} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
              <input type="checkbox" checked={teamKeys.has(team.key)} onChange={() => toggleTeam(team.key)} />
              {team.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-ink">Permissions</h2>
        {isAdminTier && (
          <p className="mt-1 text-xs text-amber-600">
            This user is an admin tier and has full access to every module regardless of the levels below.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {modules.map((m) => (
            <div key={m.key} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-ink"><span className="grid h-4 w-4 place-items-center"><ModuleGlyph moduleKey={m.key} icon={m.icon} className="h-4 w-4" /></span>{m.name}</span>
              <select
                value={levels[m.key]}
                onChange={(e) => setLevels((prev) => ({ ...prev, [m.key]: e.target.value }))}
                className="input w-32"
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl.charAt(0) + lvl.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <button onClick={submit} disabled={pending} className="btn-primary">
        {pending ? "…" : t("common.saveAll")}
      </button>
    </div>
  );
}
