import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCustomers } from "@/lib/customers/customers-service";

export default async function CustomersPage() {
  const access = await requireModule("order_requests", "VIEW");
  const canManage = access.canModule("order_requests", "OPERATE");
  const [t, rows] = await Promise.all([getT(), listCustomers()]);
  return (
    <AppShell
      access={access}
      moduleKey="order_requests"
      pageTitle={t("customers.title")}
      actions={canManage ? <Link href="/customers/new" className="btn-primary">+ {t("customers.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("customers.uid")}</th>
              <th className="th">{t("customers.name")}</th>
              <th className="th">{t("customers.channel")}</th>
              <th className="th">{t("customers.number")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted">{c.uid ?? "—"}</td>
                <td className="td">
                  <Link href={`/customers/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link>
                  {!c.active && <span className="ms-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("customers.inactive")}</span>}
                </td>
                <td className="td text-muted">{t(`channel.${c.contactChannel}`)}</td>
                <td className="td text-muted">{c.contactNumber ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("customers.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
