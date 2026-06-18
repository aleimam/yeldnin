import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { canManageCs } from "@/lib/cs/cs-logic";
import { listRepOptions, questionsForScope } from "@/lib/cs/cs-eval-service";
import { getCsConfig } from "@/lib/cs/cs-config-service";
import { EvalForm } from "../EvalForm";

export default async function EvaluatePeriodicalPage() {
  const access = await requireUser();
  if (!canManageCs(access)) redirect("/cs-quality");
  const [t, reps, questions, config] = await Promise.all([
    getT(),
    listRepOptions(),
    questionsForScope("PERIODICAL"),
    getCsConfig(),
  ]);
  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.evaluatePeriodical")} backHref="/cs-quality">
      <EvalForm
        scope="PERIODICAL"
        reps={reps}
        questions={questions.map((q) => ({ id: q.id, criteria: q.criteria, weight: q.weight, typeId: q.typeId, typeName: q.type.name }))}
        callTypes={[]}
        valueMap={config.periodical}
      />
    </AppShell>
  );
}
