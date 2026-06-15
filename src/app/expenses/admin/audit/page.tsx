import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listAudit } from "@/lib/audit";
import { userNameMap } from "@/lib/expenses/expenses-service";

export default async function AuditPage() {
  const access = await requireModule("expenses", "MANAGE");
  const t = await getT();
  const rows = await listAudit("expenseTransaction", 200);
  const names = await userNameMap(rows.map((r) => r.userId));

  return (
    <AppShell access={access} moduleKey="expenses" pageTitle={t("exp.audit")}>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("exp.date")}</th>
              <th className="th">{t("exp.user")}</th>
              <th className="th">{t("exp.action")}</th>
              <th className="th">#</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td whitespace-nowrap text-muted">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="td">{r.userId ? (names.get(r.userId) ?? `#${r.userId}`) : "—"}</td>
                <td className="td">{r.action}</td>
                <td className="td text-muted">{r.entityId}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={4}>—</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
