import Link from "next/link";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";
import { formatBizDate } from "@/lib/format/dates";
import { statusLabelKey } from "@/lib/inquiry/inquiry-logic";
import {
  listMyInquiries,
  listAllInquiriesPaged,
  inquiryAnalytics,
  listDispositions,
  type InquiryListRow,
} from "@/lib/inquiry/inquiry-service";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { ListSearch } from "@/components/ListSearch";
import { DispositionEditor } from "@/components/inquiry/DispositionEditor";

function pillTone(status: string): string {
  return status === "CLOSED"
    ? "bg-canvas text-muted"
    : status === "ANSWERED"
      ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
      : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
}

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireUser();
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, locale, mine, all, analytics, dispositions] = await Promise.all([
    getT(),
    getLocale(),
    listMyInquiries(access.user.id),
    access.isAdmin ? listAllInquiriesPaged({ search: sp.q, skip, take }) : Promise.resolve(null),
    access.isAdmin ? inquiryAnalytics() : Promise.resolve(null),
    access.isAdmin ? listDispositions() : Promise.resolve(null),
  ]);

  const row = (r: InquiryListRow) => (
    <Link
      key={r.id}
      href={`/inquiries/${r.id}`}
      className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5 last:border-0 hover:bg-canvas"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{t(`inq.kind.${r.unitKind}`)} #{r.unitId}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pillTone(r.status)}`}>
            {t(statusLabelKey(r.status))}
          </span>
        </div>
        <div className="truncate text-xs text-muted">
          {displayName(r.initiator, locale)} → {displayName(r.recipient, locale)}
        </div>
      </div>
      <div className="shrink-0 text-end text-[11px] text-muted">
        <div>{formatBizDate(r.updatedAt)}</div>
        {r.dispositionLabel && (
          <div className="text-ink">{locale === "ar" && r.dispositionLabelAr ? r.dispositionLabelAr : r.dispositionLabel}</div>
        )}
      </div>
    </Link>
  );

  const metric = (label: string, value: string | number) => (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-lg font-bold text-ink">{value}</div>
    </div>
  );

  return (
    <AppShell access={access} moduleKey="inquiries" pageTitle={t("inq.title")}>
      {analytics && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metric(t("inq.total"), analytics.total)}
          {metric(t("inq.status.OPEN"), analytics.byStatus.OPEN)}
          {metric(t("inq.status.ANSWERED"), analytics.byStatus.ANSWERED)}
          {metric(
            t("inq.avgAnswer"),
            analytics.avgAnswerHours != null ? `${analytics.avgAnswerHours.toFixed(1)}${t("inq.hours")}` : "—",
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <h2 className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">{t("inq.myInquiries")}</h2>
        {mine.length ? mine.map(row) : <p className="px-3 py-6 text-center text-sm text-muted">{t("inq.empty")}</p>}
      </div>

      {all && (
        <div className="mt-6">
          <ListSearch basePath="/inquiries" value={sp.q ?? ""} placeholder={t("inq.searchPlaceholder")} />
          <div className="card overflow-hidden">
            <h2 className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">{t("inq.allInquiries")}</h2>
            {all.rows.length ? all.rows.map(row) : <p className="px-3 py-6 text-center text-sm text-muted">{t("inq.empty")}</p>}
          </div>
          <Paginator basePath="/inquiries" params={sp} page={page} perPage={perPage} total={all.total} />
        </div>
      )}

      {dispositions && <DispositionEditor dispositions={dispositions} />}
    </AppShell>
  );
}
