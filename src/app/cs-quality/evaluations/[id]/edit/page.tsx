import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { canManageCs, canEditEvaluation } from "@/lib/cs/cs-logic";
import { listRepOptions, questionsForScope, getEvaluationForEdit } from "@/lib/cs/cs-eval-service";
import { listCsTypes } from "@/lib/cs/cs-types-service";
import { getCsConfig } from "@/lib/cs/cs-config-service";
import { EvalForm, type EvalInitial } from "../../../evaluate/EvalForm";

const ymd = (d: Date) => new Date(d).toISOString().slice(0, 10);

export default async function EditEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const { id } = await params;
  const ev = await getEvaluationForEdit(Number(id));
  if (!ev) notFound();
  const canEdit = canEditEvaluation({ isAdmin: canManageCs(access), isEvaluator: ev.evaluatorUserId === access.user.id, createdAt: ev.createdAt });
  if (!canEdit) redirect(`/cs-quality/evaluations/${id}`);

  const scope = ev.scope as "CALL" | "PERFORMANCE";
  const [t, reps, questions, types, config] = await Promise.all([
    getT(),
    listRepOptions(access.user.id),
    questionsForScope(scope),
    listCsTypes(scope),
    getCsConfig(),
  ]);

  const initial: EvalInitial = {
    subjectId: String(ev.subjectUserId),
    callTypeId: scope === "CALL" ? String(types.find((c) => c.name === ev.typeName)?.id ?? types[0]?.id ?? "") : "",
    callDate: ymd(ev.callDate ?? ev.createdAt),
    channel: ev.channel ?? "",
    contact: ev.contact ?? "",
    answers: Object.fromEntries(ev.answers.map((a) => [a.questionId, a.level])),
    notes: Object.fromEntries(ev.answers.filter((a) => a.note).map((a) => [a.questionId, a.note as string])),
    photos: ev.photos.map((p) => ({ id: p.assetId, url: `/api/asset/${p.assetId}` })),
  };

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={`${t("common.edit")} · ${ev.uid ?? `#${ev.id}`}`} backHref={`/cs-quality/evaluations/${id}`}>
      <EvalForm
        scope={scope}
        evalId={ev.id}
        initial={initial}
        reps={reps}
        questions={questions.map((q) => ({ id: q.id, title: q.title, titleAr: q.titleAr, criteria: q.criteria, criteriaAr: q.criteriaAr, tags: q.tags, tagsAr: q.tagsAr, weight: q.weight, typeId: q.typeId, typeName: q.type.name, typeNameAr: q.type.nameAr }))}
        callTypes={scope === "CALL" ? types.map((c) => ({ id: c.id, name: c.name, nameAr: c.nameAr })) : []}
        typeCount={types.length}
        valueMap={scope === "CALL" ? config.call : config.performance}
      />
    </AppShell>
  );
}
