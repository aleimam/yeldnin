import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { myEmployeeId } from "@/lib/evaluation/eval-evaluate-service";
import { latestResultCycle } from "@/lib/evaluation/eval-analytics-service";

export default async function ResultsIndexPage() {
  const access = await requireModule("evaluation", "VIEW");
  const t = await getT();
  const empId = access.user ? await myEmployeeId(access.user.id) : null;
  const latest = empId ? await latestResultCycle(empId) : null;
  if (latest) redirect(`/evaluation/results/${latest}`);

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={t("eval.myResults")}>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-ink">{t("eval.myResults")}</h1>
        <p className="alert-info text-sm">{t("eval.noResultsYet")}</p>
      </div>
    </AppShell>
  );
}
