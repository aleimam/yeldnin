import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listUsers } from "@/lib/users/users-service";
import { assetUrl } from "@/lib/assets/assets-service";

export default async function UsersPage() {
  const access = await requireModule("user_access", "VIEW");
  const canManage = access.can("user_access", "manageUsers");
  const [t, users] = await Promise.all([getT(), listUsers()]);

  return (
    <AppShell
      access={access}
      moduleKey="user_access"
      actions={canManage ? <Link href="/users/new" className="btn-primary">+ {t("users.newUser")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
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
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-canvas/60">
                <td className="td">
                  <Link href={`/users/${u.id}`} className="flex items-center gap-2.5 font-medium text-brand hover:underline">
                    {assetUrl(u.avatarUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl(u.avatarUrl)!} alt="" className="h-7 w-7 rounded-full border border-line object-cover" />
                    ) : (
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-canvas text-xs text-muted">{u.name.charAt(0).toUpperCase()}</span>
                    )}
                    {u.name}
                  </Link>
                  {u.uid && <span className="ms-9 block text-xs text-muted">{u.uid}</span>}
                </td>
                <td className="td text-muted">{u.email}</td>
                <td className="td">{t(`tier.${u.tier}`)}</td>
                <td className="td text-muted">{u.teamMembers.map((tm) => tm.team.name).join(", ") || "—"}</td>
                <td className="td">
                  {u.active ? <span className="text-green-600">{t("users.active")}</span> : <span className="text-muted">{t("users.inactive")}</span>}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("users.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
