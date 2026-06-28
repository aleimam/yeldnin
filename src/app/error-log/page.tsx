import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listErrorLogsPaged, errorLogSources } from "@/lib/errors/error-log-service";
import { userNameMap } from "@/lib/expenses/expenses-service";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { ErrorLogFilters } from "./ErrorLogFilters";
import { ErrorLogToolbar } from "./ErrorLogToolbar";

const LEVEL_TONE: Record<string, string> = {
  error: "text-red-600",
  warn: "text-amber-600",
  info: "text-muted",
};

export default async function ErrorLogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("error_log", "VIEW");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }, sources] = await Promise.all([
    getT(),
    listErrorLogsPaged({ level: sp.level, source: sp.source, search: sp.q, skip, take }),
    errorLogSources(),
  ]);
  const names = await userNameMap(rows.map((r) => r.userId));
  const canManage = access.canModule("error_log", "MANAGE");

  return (
    <AppShell access={access} moduleKey="error_log" pageTitle={t("module.error_log.name")} actions={canManage ? <ErrorLogToolbar /> : null}>
      <ErrorLogFilters basePath="/error-log" current={{ q: sp.q ?? "", level: sp.level ?? "", source: sp.source ?? "" }} sources={sources} />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("errlog.when")}</th>
              <th className="th">{t("errlog.level")}</th>
              <th className="th">{t("errlog.source")}</th>
              <th className="th">{t("errlog.message")}</th>
              <th className="th">{t("errlog.url")}</th>
              <th className="th">{t("errlog.user")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-canvas/60">
                <td className="td whitespace-nowrap text-muted" data-datecol data-label={t("errlog.when")}>{new Date(r.createdAt).toLocaleString()}</td>
                <td className={`td font-medium ${LEVEL_TONE[r.level] ?? "text-ink"}`} data-label={t("errlog.level")}>{t(`errlog.lvl.${r.level}`)}</td>
                <td className="td font-mono text-xs text-muted" data-label={t("errlog.source")}>{r.source ?? "—"}</td>
                <td className="td" data-label={t("errlog.message")}>
                  <div className="max-w-md whitespace-pre-wrap break-words">{r.message}</div>
                  {r.stack && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-brand">{t("errlog.stack")}</summary>
                      <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap break-words rounded bg-canvas p-2 text-xs text-muted">{r.stack}</pre>
                    </details>
                  )}
                </td>
                <td className="td font-mono text-xs text-muted" data-label={t("errlog.url")}>{r.method ? `${r.method} ` : ""}{r.url ?? "—"}</td>
                <td className="td text-muted" data-label={t("errlog.user")}>{r.userId ? (names.get(r.userId) ?? `#${r.userId}`) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("errlog.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/error-log" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
