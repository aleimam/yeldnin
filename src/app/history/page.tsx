import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { listRecentEvents } from "@/lib/history/history-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { HistorySearch } from "./HistorySearch";

export default async function HistoryPage() {
  const access = await requireModule("history", "VIEW");
  const [t, locale, events, wf] = await Promise.all([getT(), getLocale(), listRecentEvents(), getWorkflow()]);
  const loc = locale === "ar" ? "ar" : "en";
  const change = (from: string | null, to: string) =>
    from && from !== to ? `${wf.label(from as ItemStatus, loc)} → ${wf.label(to as ItemStatus, loc)}` : `→ ${wf.label(to as ItemStatus, loc)}`;

  return (
    <AppShell access={access} moduleKey="history" pageTitle={t("history.title")}>
      <HistorySearch />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("history.when")}</th>
              <th className="th">{t("history.item")}</th>
              <th className="th">{t("history.product")}</th>
              <th className="th">{t("history.change")}</th>
              <th className="th">{t("history.action")}</th>
              <th className="th">{t("history.by")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-canvas/60">
                <td className="td whitespace-nowrap text-muted">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="td font-mono text-xs">
                  <Link href={`/history/items/${e.itemId}`} className="text-brand hover:underline">{e.itemUid ?? e.itemId}</Link>
                </td>
                <td className="td">{e.productName}</td>
                <td className="td">{change(e.fromStatus, e.toStatus)}</td>
                <td className="td text-muted">{e.action ?? "—"}</td>
                <td className="td text-muted">{e.byName ?? "—"}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("history.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
