import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listShipments } from "@/lib/operations/operations-service";

export default async function ShipmentsPage() {
  const access = await requireModule("operations", "VIEW");
  const [t, rows] = await Promise.all([getT(), listShipments()]);
  return (
    <AppShell access={access} moduleKey="operations" pageTitle={t("shipments.title")}>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("shipments.uid")}</th>
              <th className="th">{t("shipments.scope")}</th>
              <th className="th">{t("shipments.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted">
                  <Link href={`/shipments/${s.id}`} className="text-brand hover:underline">{s.uid ?? s.id}</Link>
                </td>
                <td className="td text-muted">{t(`scope.${s.scope}`)}</td>
                <td className="td">{t(`shipmentstatus.${s.status}`)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={3}>{t("shipments.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
