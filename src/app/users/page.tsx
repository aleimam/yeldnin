import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { cookies } from "next/headers";
import { listUsersPaged, listTeams } from "@/lib/users/users-service";
import { displayName } from "@/lib/users/users-logic";
import { assetUrl } from "@/lib/assets/assets-service";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { UsersFilters } from "./UsersFilters";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("user_access", "VIEW");
  const canManage = access.can("user_access", "manageUsers");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, locale, { rows: users, total }, teams] = await Promise.all([
    getT(),
    getLocale(),
    listUsersPaged({ search: sp.q, tier: sp.tier, teamKey: sp.team, active: sp.active, sort: sp.sort, skip, take }),
    listTeams(),
  ]);

  return (
    <AppShell
      access={access}
      moduleKey="user_access"
      actions={canManage ? <Link href="/users/new" className="btn-primary">+ {t("users.newUser")}</Link> : null}
    >
      <UsersFilters basePath="/users" current={{ q: sp.q ?? "", tier: sp.tier ?? "", team: sp.team ?? "", active: sp.active ?? "", sort: sp.sort ?? "" }} teams={teams.map((tm) => ({ key: tm.key, name: tm.name }))} />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("users.name")}</th>
              <th className="th">{t("users.email")}</th>
              <th className="th">{t("users.tier")}</th>
              <th className="th">{t("users.teams")}</th>
              <th className="th">{t("users.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => {
              const dn = displayName(u, locale);
              return (
              <tr key={u.id} className="hover:bg-canvas/60">
                <td className="td" data-label={t("users.name")}>
                  <Link href={`/users/${u.id}`} className="flex items-center gap-2.5 font-medium text-brand hover:underline">
                    {assetUrl(u.avatarUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl(u.avatarUrl)!} alt="" className="h-7 w-7 rounded-full border border-line object-cover" />
                    ) : (
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-canvas text-xs text-muted">{dn.charAt(0).toUpperCase()}</span>
                    )}
                    {dn}
                  </Link>
                  {u.uid && <span className="ms-9 block text-xs text-muted">{u.uid}</span>}
                </td>
                <td className="td text-muted" data-label={t("users.email")}>{u.email}</td>
                <td className="td" data-label={t("users.tier")}>{t(`tier.${u.tier}`)}</td>
                <td className="td text-muted" data-label={t("users.teams")}>{u.teamMembers.map((tm) => tm.team.name).join(", ") || "—"}</td>
                <td className="td" data-label={t("users.status")}>
                  {u.active ? <span className="text-green-600">{t("users.active")}</span> : <span className="text-muted">{t("users.inactive")}</span>}
                </td>
              </tr>
              );
            })}
            {users.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("users.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/users" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
