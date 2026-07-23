import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";
import { getOpenCycle } from "@/lib/evaluation/eval-cycle-service";
import { myEmployeeId, myEvaluateList, type EvaluateListItem } from "@/lib/evaluation/eval-evaluate-service";

function StatusChip({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    SUBMITTED: "bg-green-100 text-green-700",
    NA: "bg-canvas text-muted",
    PENDING: "bg-amber-100 text-amber-700",
  };
  const label = status === "SUBMITTED" ? t("eval.done") : status === "NA" ? t("eval.na") : t("eval.notStarted");
  return <span className={`rounded px-2 py-0.5 text-xs ${map[status] ?? map.PENDING}`}>{label}</span>;
}

export default async function EvaluateListPage() {
  const access = await requireModule("evaluation", "VIEW");
  const t = await getT();
  const locale = await getLocale();

  const empId = access.user ? await myEmployeeId(access.user.id) : null;
  const cycle = await getOpenCycle();

  let list = null;
  if (empId && cycle) list = await myEvaluateList(cycle.id, empId);

  const row = (it: EvaluateListItem) => (
    <Link
      key={it.subjectEmpId}
      href={`/evaluation/evaluate/${it.subjectEmpId}`}
      className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-canvas/60"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">
          {it.isSelf ? t("eval.yourself") : displayName({ name: it.name, nameAr: it.nameAr }, locale)}
        </span>
        {!it.isSelf && it.deptLabel && <span className="block truncate text-xs text-muted">{it.deptLabel}</span>}
      </span>
      <StatusChip status={it.status} t={t} />
    </Link>
  );

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={t("eval.myReviews")}>
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-ink">{t("eval.myReviews")}</h1>
          {cycle && <p className="text-sm text-muted">{cycle.name}</p>}
        </header>

        {!empId ? (
          <p className="alert-info text-sm">{t("eval.noEmployeeRecord")}</p>
        ) : !cycle ? (
          <p className="alert-info text-sm">{t("eval.noOpenCycle")}</p>
        ) : !list || list.total === 0 ? (
          <p className="alert-info text-sm">{t("eval.notParticipant")}</p>
        ) : (
          <>
            {/* progress */}
            <div className="card p-4">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted">{t("eval.progress")}</span>
                <span className="font-medium text-ink">
                  {list.done}/{list.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-canvas">
                <div className="h-full bg-brand" style={{ width: `${list.total ? Math.round((list.done / list.total) * 100) : 0}%` }} />
              </div>
            </div>

            {/* self pinned */}
            <div className="card p-0">{list.items.filter((i) => i.isSelf).map(row)}</div>

            {/* others grouped by department */}
            {Object.entries(
              list.items
                .filter((i) => !i.isSelf)
                .reduce<Record<string, EvaluateListItem[]>>((acc, i) => {
                  const key = i.deptLabel || t("eval.otherDept");
                  (acc[key] ??= []).push(i);
                  return acc;
                }, {}),
            ).map(([dept, items]) => (
              <section key={dept} className="space-y-2">
                <h2 className="text-sm font-semibold text-ink">{dept}</h2>
                <div className="card p-0">{items.map(row)}</div>
              </section>
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
