import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCsQuestions } from "@/lib/cs/cs-question-service";
import { listCsTypes } from "@/lib/cs/cs-types-service";
import { QuestionPool } from "./QuestionPool";

export default async function CsQuestionsPage() {
  const access = await requireModule("cs_quality", "MANAGE");
  const [t, questions, callTypes, periodicalTypes] = await Promise.all([
    getT(),
    listCsQuestions(),
    listCsTypes("CALL"),
    listCsTypes("PERFORMANCE"),
  ]);
  const types = [...callTypes, ...periodicalTypes].map((ty) => ({ id: ty.id, name: ty.name, scope: ty.scope }));
  const rows = questions.map((q) => ({
    id: q.id,
    title: q.title,
    criteria: q.criteria,
    tags: q.tags,
    weight: q.weight,
    scope: q.scope,
    typeId: q.typeId,
    active: q.active,
    typeName: q.type.name,
  }));

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.questionPool")} backHref="/cs-quality">
      <QuestionPool questions={rows} types={types} />
    </AppShell>
  );
}
