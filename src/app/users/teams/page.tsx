import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listTeamsWithCounts } from "@/lib/teams/teams-service";
import { createTeamAction } from "./actions";

export default async function TeamsPage() {
  const access = await requireModule("user_access", "VIEW");
  const [t, teams] = await Promise.all([getT(), listTeamsWithCounts()]);
  const canManage = access.can("user_access", "manageTeams");

  return (
    <AppShell access={access} moduleKey="user_access" pageTitle={t("users.teams")}>
      {canManage && (
        <form action={createTeamAction} className="card mb-6 flex items-end gap-3 p-4">
          <div className="flex-1">
            <label className="label">{t("teams.name")}</label>
            <input name="name" className="input" required placeholder={t("teams.newPlaceholder")} />
          </div>
          <button className="btn-primary">{t("teams.create")}</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("teams.name")}</th>
              <th className="th">{t("teams.members")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {teams.map((team) => (
              <tr key={team.id} className="hover:bg-canvas/60">
                <td className="td">
                  <Link href={`/users/teams/${team.id}`} className="font-medium text-brand hover:underline">
                    {team.name}
                  </Link>
                </td>
                <td className="td text-muted">{team._count.members}</td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr><td className="td text-muted" colSpan={2}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
