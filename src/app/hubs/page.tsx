import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listHubs } from "@/lib/hubs/hubs-service";

export default async function HubsPage() {
  const access = await requireModule("logistics", "VIEW");
  const canManage = access.canModule("logistics", "OPERATE");
  const [t, rows] = await Promise.all([getT(), listHubs()]);
  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("hubs.title")}
      actions={canManage ? <Link href="/hubs/new" className="btn-primary">+ {t("hubs.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("hubs.uid")}</th>
              <th className="th">{t("hubs.name")}</th>
              <th className="th">{t("hubs.country")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((h) => (
              <tr key={h.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted">{h.uid ?? "—"}</td>
                <td className="td">
                  <Link href={`/hubs/${h.id}`} className="font-medium text-brand hover:underline">{h.name}</Link>
                  {h._count.photos > 0 && <span className="ms-2 text-xs text-muted">📎{h._count.photos}</span>}
                  {!h.active && <span className="ms-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("hubs.inactive")}</span>}
                </td>
                <td className="td text-muted">{h.country}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={3}>{t("hubs.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
