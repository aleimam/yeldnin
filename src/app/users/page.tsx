import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { listUsers } from "@/lib/users/users-service";
import { assetUrl } from "@/lib/assets/assets-service";

const TIER_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export default async function UsersPage() {
  const access = await requireModule("user_access", "VIEW");
  const canManage = access.canModule("user_access", "MANAGE");
  const users = await listUsers();

  return (
    <AppShell
      access={access}
      moduleKey="user_access"
      actions={
        canManage ? (
          <Link href="/users/new" className="btn-primary">
            + New user
          </Link>
        ) : null
      }
    >
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">Name</th>
              <th className="th">Email</th>
              <th className="th">Tier</th>
              <th className="th">Teams</th>
              <th className="th">Status</th>
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
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-canvas text-xs text-muted">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {u.name}
                  </Link>
                </td>
                <td className="td text-muted">{u.email}</td>
                <td className="td">{TIER_LABEL[u.tier] ?? u.tier}</td>
                <td className="td text-muted">
                  {u.teamMembers.map((tm) => tm.team.name).join(", ") || "—"}
                </td>
                <td className="td">
                  {u.active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-muted">Inactive</span>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={5}>
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
