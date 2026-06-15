import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getUserDetail, listTeams } from "@/lib/users/users-service";
import { MAIN_MODULES, ADMIN_MODULES } from "@/lib/modules";
import { LEVELS } from "@/lib/auth/access-logic";
import { saveAccessAction } from "../actions";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireModule("user_access", "MANAGE");
  const { id } = await params;
  const userId = Number(id);
  const [user, teams, t] = await Promise.all([
    getUserDetail(userId),
    listTeams(),
    getT(),
  ]);
  if (!user) notFound();

  const teamSet = new Set(user.teamMembers.map((tm) => tm.team.key));
  const levelOf = new Map(user.modulePerms.map((p) => [p.moduleKey, p.level]));
  const isAdminTier = user.tier === "ADMIN" || user.tier === "SUPER_ADMIN";

  return (
    <AppShell access={access} moduleKey="user_access" pageTitle={user.name} backHref="/users">
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm
          user={{
            id: user.id,
            name: user.name,
            email: user.email,
            tier: user.tier,
            active: user.active,
          }}
        />
        <PasswordForm userId={user.id} />
      </div>

      <form action={saveAccessAction} className="card mt-6 space-y-6 p-6">
        <input type="hidden" name="id" value={user.id} />

        <div>
          <h2 className="font-semibold text-ink">Teams</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {teams.map((team) => (
              <label
                key={team.key}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  name="team"
                  value={team.key}
                  defaultChecked={teamSet.has(team.key)}
                />
                {team.name}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-ink">Module access</h2>
          {isAdminTier && (
            <p className="mt-1 text-xs text-amber-600">
              This user is {user.tier === "SUPER_ADMIN" ? "a Super Admin" : "an Admin"} and has full
              access to every module regardless of the levels below.
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[...MAIN_MODULES, ...ADMIN_MODULES].map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-ink">
                  <span>{m.icon}</span>
                  {t(`module.${m.key}.name`)}
                </span>
                <select
                  name={`level.${m.key}`}
                  defaultValue={levelOf.get(m.key) ?? "NONE"}
                  className="input w-32"
                >
                  {LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl.charAt(0) + lvl.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save all
        </button>
      </form>
    </AppShell>
  );
}
