import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { getItemWithEvents } from "@/lib/history/history-service";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";
import { FlagItemsControl } from "@/app/exceptions/FlagItemsControl";
import { InquiryLauncher } from "@/components/inquiry/InquiryLauncher";

export default async function ItemHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("history", "VIEW");
  const { id } = await params;
  const item = await getItemWithEvents(Number(id));
  if (!item) notFound();
  const [t, locale, wf] = await Promise.all([getT(), getLocale(), getWorkflow()]);
  const loc = locale === "ar" ? "ar" : "en";
  const canFlag = access.isAdmin || access.can("logistics", "operate") || access.can("operations", "operate");

  return (
    <AppShell access={access} moduleKey="history" pageTitle={item.uid ?? `#${item.id}`} backHref="/history">
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div><span className="text-muted">{t("history.product")}: </span><span className="text-ink">{item.product.name}</span></div>
            <div><span className="text-muted">{t("requests.scope")}: </span><span className="text-ink">{t(`scope.${item.scope}`)}</span></div>
            <div><span className="text-muted">{t("requests.status")}: </span><span className="text-ink">{wf.label(item.status as ItemStatus, loc)}</span></div>
            <div><span className="text-muted">{t("history.location")}: </span><span className="text-ink">{item.containerType ? `${item.containerType}${item.containerId ? " #" + item.containerId : ""}` : "—"}</span></div>
            {item.exceptionFlag && (
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">{t(`exceptions.pool.${item.exceptionFlag}`)}</span>
                {canFlag && <Link href={`/exceptions?pool=${item.exceptionFlag}`} className="text-xs text-brand hover:underline">{t("exceptions.resolve")} →</Link>}
              </div>
            )}
          </div>
        </div>

        {canFlag && !item.exceptionFlag && (
          <FlagItemsControl items={[{ id: item.id, label: `${item.product.name} ${item.uid ?? `#${item.id}`}` }]} single />
        )}

        <InquiryLauncher unitKind="ITEM" unitId={item.id} />

        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("history.timeline")}</h2>
          <ol className="space-y-2">
            {item.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-line/60 py-1.5 text-sm">
                <span className="whitespace-nowrap text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</span>
                <span className="text-ink">
                  {e.fromStatus && e.fromStatus !== e.toStatus
                    ? `${wf.label(e.fromStatus as ItemStatus, loc)} → ${wf.label(e.toStatus as ItemStatus, loc)}`
                    : wf.label(e.toStatus as ItemStatus, loc)}
                </span>
                {e.action && <span className="text-xs text-muted">· {e.action}</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </AppShell>
  );
}
