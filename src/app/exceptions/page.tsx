import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { EXCEPTION_POOLS, isExceptionPool, resolutionActions } from "@/lib/exceptions/exception-logic";
import { listExceptions, tripsForPicker, hubsForPicker } from "@/lib/exceptions/exception-service";
import { ExceptionActions } from "./ExceptionActions";

export default async function ExceptionsPage({ searchParams }: { searchParams: Promise<{ pool?: string }> }) {
  const access = await requireUser();
  if (!access.isAdmin && !access.can("logistics", "operate") && !access.can("operations", "operate")) redirect("/");
  const sp = await searchParams;
  const activePool = isExceptionPool(sp.pool) ? sp.pool : "LOST";
  const [t, rows, trips, hubs] = await Promise.all([getT(), listExceptions(), tripsForPicker(), hubsForPicker()]);

  const counts = Object.fromEntries(EXCEPTION_POOLS.map((p) => [p, rows.filter((r) => r.pool === p).length]));
  const poolRows = rows.filter((r) => r.pool === activePool);
  const scopes = [...new Set(poolRows.map((r) => r.scope))];
  const actions = resolutionActions(activePool);

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("exceptions.title")} backHref="/logistics">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {EXCEPTION_POOLS.map((p) => (
            <Link
              key={p}
              href={`/exceptions?pool=${p}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${p === activePool ? "border-brand bg-brand/10 font-medium text-ink" : "border-line text-muted hover:bg-canvas"}`}
            >
              {t(`exceptions.pool.${p}`)} <span className="ms-1 text-xs text-muted">{counts[p]}</span>
            </Link>
          ))}
        </div>

        {poolRows.length === 0 && <div className="card p-6 text-sm text-muted">{t("exceptions.empty")}</div>}

        {scopes.map((scope) => (
          <div key={scope} className="card overflow-x-auto p-0">
            <div className="border-b border-line bg-canvas px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">{t(`scope.${scope}`)}</div>
            <table className="w-full text-sm" data-cards>
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th className="th">{t("exceptions.item")}</th>
                  <th className="th">{t("exceptions.source")}</th>
                  <th className="th">{t("exceptions.flaggedAt")}</th>
                  <th className="th">{t("exceptions.note")}</th>
                  <th className="th">{t("exceptions.issue")}</th>
                  <th className="th text-end">{t("exceptions.resolve")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {poolRows
                  .filter((r) => r.scope === scope)
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-canvas/60">
                      <td className="td" data-label={t("exceptions.item")}>
                        <Link href={`/history/items/${r.id}`} className="text-brand hover:underline">{r.productName}</Link>
                        <span className="block font-mono text-[10px] text-muted">{r.uid ?? `#${r.id}`}</span>
                      </td>
                      <td className="td text-muted" data-label={t("exceptions.source")}>
                        {r.sourceContainerType ? `${t(`container.${r.sourceContainerType}`)} #${r.sourceContainerId}` : "—"}
                      </td>
                      <td className="td text-muted" data-label={t("exceptions.flaggedAt")}>{r.flaggedAt ? formatBizDate(r.flaggedAt) : "—"}</td>
                      <td className="td text-muted" data-label={t("exceptions.note")}>{r.note ?? "—"}</td>
                      <td className="td" data-label={t("exceptions.issue")}>
                        {r.issueId ? <Link href={`/issues/${r.issueId}`} className="text-brand hover:underline">{r.issueUid ?? `#${r.issueId}`}</Link> : "—"}
                      </td>
                      <td className="td text-end">
                        <ExceptionActions itemId={r.id} pool={activePool} actions={actions} hasRequest={r.hasRequest} issueId={r.issueId} trips={trips} hubs={hubs} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
