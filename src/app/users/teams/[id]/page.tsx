import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { getTeamDetail, listAllUsers, listTeamsWithCounts } from "@/lib/teams/teams-service";
import { connectedTeamIds } from "@/lib/evaluation/team-connections-service";
import { displayName } from "@/lib/users/users-logic";
import { TrashIcon } from "@/components/icons/TrashIcon";
import {
  renameTeamAction,
  addMemberAction,
  removeMemberAction,
  deleteTeamAction,
  setTeamConnectionsAction,
} from "../actions";
import { ActionForm } from "@/components/ActionForm";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireCapability("user_access", "manageTeams");
  const { id } = await params;
  const team = await getTeamDetail(Number(id));
  if (!team) notFound();
  const [t, locale, allUsers, allTeams, myConns] = await Promise.all([
    getT(),
    getLocale(),
    listAllUsers(),
    listTeamsWithCounts(),
    connectedTeamIds(team.id),
  ]);

  const memberIds = new Set(team.members.map((m) => m.userId));
  const candidates = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <AppShell access={access} moduleKey="user_access" pageTitle={team.name} backHref="/users/teams">
      <div className="max-w-2xl space-y-6">
        {/* Rename */}
        <ActionForm action={renameTeamAction} className="card space-y-3 p-6" saveLabel={t("common.save")}>
          <input type="hidden" name="id" value={team.id} />
          <div>
            <label className="label">{t("teams.name")}</label>
            <input name="name" className="input" defaultValue={team.name} required />
          </div>
        </ActionForm>

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
                  <button className="text-red-600 hover:text-red-700" title={t("teams.remove")} aria-label={t("teams.remove")}><TrashIcon className="h-4 w-4" /></button>
                </form>
              </li>
            ))}
            {team.members.length === 0 && <li className="py-2 text-sm text-muted">—</li>}
          </ul>
        </div>

        {/* Connected departments (360 Reviews relationship graph) */}
        <div className="card p-6">
          <h2 className="mb-1 font-semibold text-ink">{t("teams.connections")}</h2>
          <p className="mb-3 text-xs text-muted">{t("teams.connectionsHint")}</p>
          <form action={setTeamConnectionsAction} className="space-y-3">
            <input type="hidden" name="teamId" value={team.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              {allTeams.filter((tm) => tm.id !== team.id).map((tm) => (
                <label key={tm.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="connectedIds" value={tm.id} defaultChecked={myConns.includes(tm.id)} />
                  <span className="text-ink">{tm.name}</span>
                </label>
              ))}
              {allTeams.length <= 1 && <span className="text-sm text-muted">—</span>}
            </div>
            <button className="btn-primary btn-sm">{t("common.save")}</button>
          </form>
        </div>

        {/* Delete */}
        <form action={deleteTeamAction}>
          <input type="hidden" name="id" value={team.id} />
          <button className="text-red-600 hover:text-red-700" title={t("teams.delete")} aria-label={t("teams.delete")}><TrashIcon className="h-5 w-5" /></button>
        </form>
      </div>
    </AppShell>
  );
}
