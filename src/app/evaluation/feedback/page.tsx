import Link from "next/link";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";
import { listClosedCycles } from "@/lib/evaluation/eval-analytics-service";
import { feedbackQueue, getFeedback } from "@/lib/evaluation/eval-feedback-service";
import { getAiConfig } from "@/lib/evaluation/eval-ai-config-service";
import { FeedbackEditor } from "./FeedbackEditor";
import { generateBatchAction, releaseAllAction } from "./actions";

type SP = { cycle?: string; emp?: string };

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<SP> }) {
  const access = await requireCapability("evaluation", "manage");
  const t = await getT();
  const locale = await getLocale();
  const sp = await searchParams;

  const [cycles, ai] = await Promise.all([listClosedCycles(), getAiConfig()]);
  if (cycles.length === 0) {
    return (
      <AppShell access={access} moduleKey="evaluation" pageTitle={t("eval.aiFeedback")}>
        <div className="space-y-4">
          <h1 className="text-xl font-semibold text-ink">{t("eval.aiFeedback")}</h1>
          <p className="alert-info text-sm">{t("eval.noClosedCycles")}</p>
        </div>
      </AppShell>
    );
  }

  const cycleId = Number(sp.cycle) || cycles[0].id;
  const empId = sp.emp ? Number(sp.emp) : null;
  const [rows, detail] = await Promise.all([feedbackQueue(cycleId), empId ? getFeedback(cycleId, empId) : Promise.resolve(null)]);
  const releasable = rows.filter((r) => r.status === "GENERATED").length;

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={t("eval.aiFeedback")}>
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">{t("eval.aiFeedback")}</h1>
        </header>

        {/* cycle picker */}
        <div className="flex flex-wrap gap-2">
          {cycles.map((c) => (
            <Link key={c.id} href={`/evaluation/feedback?cycle=${c.id}`} className={`btn-sm border ${c.id === cycleId ? "border-brand bg-brand/10 text-brand" : "border-line text-ink"}`}>
              {c.name}
            </Link>
          ))}
        </div>

        {!ai.configured ? (
          <p className="alert-info text-sm">
            {t("eval.ai.notConfigured")} —{" "}
            <Link href="/settings/evaluation" className="text-brand underline">
              {t("eval.ai.settings")}
            </Link>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <form action={generateBatchAction}>
              <input type="hidden" name="cycleId" value={cycleId} />
              <button className="btn-primary btn-sm">{t("eval.generateAll")}</button>
            </form>
            {releasable > 0 && (
              <form action={releaseAllAction}>
                <input type="hidden" name="cycleId" value={cycleId} />
                <button className="btn-sm border border-line">{t("eval.releaseAll")} ({releasable})</button>
              </form>
            )}
            <span className="self-center text-xs text-muted">{t("eval.generateHint")}</span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          {/* queue */}
          <div className="card max-h-[70vh] overflow-y-auto p-0">
            {rows.map((r) => (
              <Link
                key={r.subjectEmpId}
                href={`/evaluation/feedback?cycle=${cycleId}&emp=${r.subjectEmpId}`}
                className={`flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-canvas/60 ${r.subjectEmpId === empId ? "bg-brand/10" : ""}`}
              >
                <span className="min-w-0 truncate text-ink">{displayName({ name: r.name, nameAr: r.nameAr }, locale)}</span>
                <span className="shrink-0 text-xs text-muted">{t(`eval.fbStatus.${r.status}`)}</span>
              </Link>
            ))}
          </div>

          {/* editor */}
          <div>
            {!detail ? (
              <p className="text-sm text-muted">{t("eval.pickEmployee")}</p>
            ) : (
              <>
                <h2 className="mb-3 text-lg font-semibold text-ink">{displayName({ name: detail.name, nameAr: detail.nameAr }, locale)}</h2>
                <FeedbackEditor cycleId={cycleId} detail={detail} />
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
