import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { requestScopes, primaryRequestModule } from "@/lib/requests/request-logic";
import { listRequests } from "@/lib/requests/request-service";
import { itemStatusSummary } from "@/lib/items/items-service";
import { ITEM_BUCKETS } from "@/lib/items/items-logic";

export default async function RequestsPage() {
  const access = await requireUser();
  const visible = requestScopes(access, "VIEW");
  if (!visible.length) redirect("/");
  const canManage = requestScopes(access, "OPERATE").length > 0;
  const [t, rows, summary] = await Promise.all([getT(), listRequests({ scopes: visible }), itemStatusSummary(visible)]);

  return (
    <AppShell
      access={access}
      moduleKey={primaryRequestModule(access)}
      pageTitle={t("requests.title")}
      actions={canManage ? <Link href="/requests/new" className="btn-primary">+ {t("requests.new")}</Link> : null}
    >
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ITEM_BUCKETS.map((b) => (
          <div key={b} className="card p-3 text-center">
            <div className={`text-2xl font-bold ${b === "problems" && summary[b] > 0 ? "text-red-600" : "text-ink"}`}>{summary[b]}</div>
            <div className="text-xs text-muted">{t(`rdash.${b}`)}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("requests.uid")}</th>
              <th className="th">{t("requests.type")}</th>
              <th className="th">{t("requests.scope")}</th>
              <th className="th">{t("requests.customer")}</th>
              <th className="th text-end">{t("requests.lines")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted">
                  <Link href={`/requests/${r.id}`} className="text-brand hover:underline">{r.uid ?? r.id}</Link>
                </td>
                <td className="td">{t(`reqtype.${r.type}`)}</td>
                <td className="td text-muted">{t(`scope.${r.scope}`)}</td>
                <td className="td text-muted">{r.customer?.name ?? "—"}</td>
                <td className="td text-end text-muted">{r._count.lines}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("requests.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
