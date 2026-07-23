import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { getOpenCycle } from "@/lib/evaluation/eval-cycle-service";
import { myEmployeeId, myEvaluateList } from "@/lib/evaluation/eval-evaluate-service";

export default async function EvaluationPage() {
  const access = await requireModule("evaluation", "VIEW");
  const t = await getT();
  const canManage = access.can("evaluation", "manage");

  // Open-cycle status card for participants.
  const empId = access.user ? await myEmployeeId(access.user.id) : null;
  const cycle = await getOpenCycle();
  const list = empId && cycle ? await myEvaluateList(cycle.id, empId) : null;

  const cards: { href: string; icon: string; label: string; ready: boolean; admin?: boolean }[] = [
    { href: "/evaluation/evaluate", icon: "📝", label: t("eval.myReviews"), ready: true },
    { href: "/evaluation", icon: "📈", label: t("eval.myResults"), ready: false },
    { href: "/evaluation/criteria", icon: "📋", label: t("eval.criteria"), ready: true, admin: true },
    { href: "/evaluation/cycles", icon: "🗓️", label: t("eval.cycles"), ready: true, admin: true },
    { href: "/evaluation", icon: "📊", label: t("eval.analytics"), ready: false, admin: true },
    { href: "/evaluation", icon: "🤖", label: t("eval.aiFeedback"), ready: false, admin: true },
  ].filter((c) => !c.admin || canManage);

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={t("module.evaluation.name")}>
      <div className="space-y-6">
        {list && list.total > 0 ? (
          <div className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-ink">{cycle!.name}</p>
                <p className="text-sm text-muted">
                  {t("eval.deadline")}: {formatBizDate(cycle!.deadline)}
                </p>
              </div>
              <Link href="/evaluation/evaluate" className="btn-primary btn-sm">
                {list.done < list.total ? t("eval.continueEvaluating") : t("eval.reviewMine")}
              </Link>
            </div>
            <div>
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
          </div>
        ) : (
          <div className="rounded-xl bg-brand/10 p-6 text-center">
            <p className="text-lg font-semibold text-ink">{t("eval.slogan")}</p>
            <p className="mt-1 text-sm text-muted">{t("eval.sloganHint")}</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) =>
            c.ready ? (
              <Link key={i} href={c.href} className="card flex items-center gap-3 p-5 hover:bg-canvas/60">
                <span className="text-2xl">{c.icon}</span>
                <span className="font-medium text-ink">{c.label}</span>
              </Link>
            ) : (
              <div key={i} className="card flex items-center justify-between gap-3 p-5 opacity-60">
                <span className="flex items-center gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <span className="font-medium text-ink">{c.label}</span>
                </span>
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("eval.soon")}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </AppShell>
  );
}
