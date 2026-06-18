import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { getTeamDetail, listAllUsers } from "@/lib/teams/teams-service";
import { displayName } from "@/lib/users/users-logic";
import {
  renameTeamAction,
  addMemberAction,
  removeMemberAction,
  deleteTeamAction,
} from "../actions";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireCapability("user_access", "manageTeams");
  const { id } = await params;
  const team = await getTeamDetail(Number(id));
  if (!team) notFound();
  const [t, locale, allUsers] = await Promise.all([getT(), getLocale(), listAllUsers()]);

  const memberIds = new Set(team.members.map((m) => m.userId));
  const candidates = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <AppShell access={access} moduleKey="user_access" pageTitle={team.name} backHref="/users/teams">
      <div className="max-w-2xl space-y-6">
        {/* Rename */}
        <form action={renameTeamAction} className="card flex items-end gap-3 p-6">
          <input type="hidden" name="id" value={team.id} />
          <div className="flex-1">
            <label className="label">{t("teams.name")}</label>
            <input name="name" className="input" defaultValue={team.name} required />
          </div>
          <button className="btn-primary">{t("common.save")}</button>
        </form>

        {/* Members */}
        <div className="card p-6">
          <h2 className="mb-3 font-semibold text-ink">{t("teams.members")}</h2>

          <form action={addMemberAction} className="mb-4 flex items-end gap-3">
            <input type="hidden" name="teamId" value={team.id} />
            <div className="flex-1">
              <label className="label">{t("teams.addMember")}</label>
              <select name="userId" className="input" required defaultValue="">
                <option value="" disabled>{t("teams.choosePerson")}</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>{displayName(u, locale)} · {u.email}</option>
                ))}
              </select>
            </div>
            <button className="btn-secondary">{t("teams.add")}</button>
          </form>

          <ul className="divide-y divide-line">
            {team.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-ink">{displayName(m.user, locale)} <span className="text-muted">· {m.user.email}</span></span>
                <form action={removeMemberAction}>
                  <input type="hidden" name="teamId" value={team.id} />
                  <input type="hidden" name="userId" value={m.userId} />
                  <button className="text-sm text-red-600 hover:underline">{t("teams.remove")}</button>
                </form>
              </li>
            ))}
            {team.members.length === 0 && <li className="py-2 text-sm text-muted">—</li>}
          </ul>
        </div>

        {/* Delete */}
        <form action={deleteTeamAction}>
          <input type="hidden" name="id" value={team.id} />
          <button className="btn-danger">{t("teams.delete")}</button>
        </form>
      </div>
    </AppShell>
  );
}
