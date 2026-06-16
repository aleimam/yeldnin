import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCouriers } from "@/lib/couriers/couriers-service";

export default async function CouriersPage() {
  const access = await requireModule("couriers", "VIEW");
  const canManage = access.canModule("couriers", "OPERATE");
  const [t, rows] = await Promise.all([getT(), listCouriers()]);
  return (
    <AppShell
      access={access}
      moduleKey="couriers"
      pageTitle={t("couriers.title")}
      actions={canManage ? <Link href="/couriers/new" className="btn-primary">+ {t("couriers.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("couriers.uid")}</th>
              <th className="th">{t("couriers.name")}</th>
              <th className="th">{t("couriers.contact")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted">{c.uid ?? c.id}</td>
                <td className="td">
                  <Link href={`/couriers/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link>
                  {!c.active && <span className="ms-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("couriers.inactive")}</span>}
                </td>
                <td className="td text-muted">{c.contact ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={3}>{t("couriers.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
