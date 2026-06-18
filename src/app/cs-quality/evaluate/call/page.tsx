import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { canEvaluateCalls } from "@/lib/cs/cs-logic";
import { listRepOptions, questionsForScope } from "@/lib/cs/cs-eval-service";
import { listCsTypes } from "@/lib/cs/cs-types-service";
import { getCsConfig } from "@/lib/cs/cs-config-service";
import { EvalForm } from "../EvalForm";

export default async function EvaluateCallPage() {
  const access = await requireUser();
  if (!canEvaluateCalls(access)) redirect("/cs-quality");
  const [t, reps, questions, callTypes, config] = await Promise.all([
    getT(),
    listRepOptions(access.user.id),
    questionsForScope("CALL"),
    listCsTypes("CALL"),
    getCsConfig(),
  ]);
  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.evaluateCall")} backHref="/cs-quality">
      <EvalForm
        scope="CALL"
        reps={reps}
        questions={questions.map((q) => ({ id: q.id, title: q.title, criteria: q.criteria, tags: q.tags, weight: q.weight, typeId: q.typeId, typeName: q.type.name }))}
        callTypes={callTypes.map((c) => ({ id: c.id, name: c.name }))}
        typeCount={callTypes.length}
        valueMap={config.call}
      />
    </AppShell>
  );
}
