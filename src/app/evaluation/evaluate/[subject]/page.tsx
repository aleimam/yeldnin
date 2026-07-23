import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";
import { getOpenCycle } from "@/lib/evaluation/eval-cycle-service";
import { myEmployeeId, loadEvaluationForm } from "@/lib/evaluation/eval-evaluate-service";
import { EvaluateForm, type FormPill } from "../EvaluateForm";

export default async function EvaluateFormPage({ params }: { params: Promise<{ subject: string }> }) {
  const access = await requireModule("evaluation", "VIEW");
  const t = await getT();
  const locale = await getLocale();
  const { subject } = await params;
  const subjectEmpId = Number(subject);

  const empId = access.user ? await myEmployeeId(access.user.id) : null;
  const cycle = await getOpenCycle();
  if (!empId || !cycle) redirect("/evaluation/evaluate");

  const form = await loadEvaluationForm(cycle.id, empId, subjectEmpId);
  if (!form) notFound();

  const loc = (en: string, ar: string | null) => (locale === "ar" && ar ? ar : en);
  const pillars: FormPill[] = form.pillars.map((p) => ({
    pillarId: p.pillarId,
    name: loc(p.name, p.nameAr),
    criteria: p.criteria.map((c) => ({
      criterionId: c.criterionId,
      title: loc(c.title, c.titleAr),
      text: loc(c.text, c.textAr),
      level: c.level,
      note: c.note,
    })),
  }));

  const subjName = form.isSelf ? t("eval.yourself") : displayName({ name: form.subject.name, nameAr: form.subject.nameAr }, locale);

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={subjName}>
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="flex items-center gap-3">
          {form.subject.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.subject.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          )}
          <div>
            <h1 className="text-xl font-semibold text-ink">{subjName}</h1>
            {!form.isSelf && form.subject.deptLabel && <p className="text-sm text-muted">{form.subject.deptLabel}</p>}
          </div>
        </header>

        <EvaluateForm
          evaluationId={form.evaluationId}
          subjectEmpId={form.subject.empId}
          isSelf={form.isSelf}
          editable={form.editable}
          initialComment={form.overallComment}
          initialNa={form.status === "NA"}
          pillars={pillars}
          prevHref={form.prevSubjectId != null ? `/evaluation/evaluate/${form.prevSubjectId}` : null}
          nextHref={form.nextSubjectId != null ? `/evaluation/evaluate/${form.nextSubjectId}` : null}
        />
      </div>
    </AppShell>
  );
}
