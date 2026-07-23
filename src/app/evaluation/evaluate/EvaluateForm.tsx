"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { StarRating } from "./StarRating";
import { saveEvaluationAction, setNaAction, type SavePayload } from "./actions";

export interface FormCrit {
  criterionId: number;
  title: string;
  text: string;
  level: number | null;
  note: string | null;
}
export interface FormPill {
  pillarId: number;
  name: string;
  criteria: FormCrit[];
}

type Save = "idle" | "saving" | "saved" | "error";

export function EvaluateForm(props: {
  evaluationId: number;
  subjectEmpId: number;
  isSelf: boolean;
  editable: boolean;
  initialComment: string;
  initialNa: boolean;
  pillars: FormPill[];
  prevHref: string | null;
  nextHref: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, { level: number | null; note: string }>>(() => {
    const m: Record<number, { level: number | null; note: string }> = {};
    for (const p of props.pillars) for (const c of p.criteria) m[c.criterionId] = { level: c.level, note: c.note ?? "" };
    return m;
  });
  const [comment, setComment] = useState(props.initialComment);
  const [na, setNa] = useState(props.initialNa);
  const [save, setSave] = useState<Save>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const payload = useCallback(
    (over?: { comment?: string; answers?: typeof answers }): SavePayload => {
      const a = over?.answers ?? answers;
      return {
        evaluationId: props.evaluationId,
        subjectEmpId: props.subjectEmpId,
        overallComment: over?.comment ?? comment,
        answers: Object.entries(a).map(([id, v]) => ({ criterionId: Number(id), level: v.level, note: v.note.trim() || null })),
      };
    },
    [answers, comment, props.evaluationId, props.subjectEmpId],
  );

  const flush = useCallback(
    async (p: SavePayload) => {
      setSave("saving");
      const res = await saveEvaluationAction(p);
      setSave(res.ok ? "saved" : "error");
    },
    [],
  );

  const scheduleSave = useCallback(
    (p: SavePayload) => {
      if (!props.editable) return;
      setSave("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(p), 800);
    },
    [flush, props.editable],
  );

  const setLevel = (criterionId: number, level: number | null) => {
    const next = { ...answers, [criterionId]: { ...answers[criterionId], level } };
    setAnswers(next);
    scheduleSave(payload({ answers: next }));
  };
  const setNote = (criterionId: number, note: string) => {
    const next = { ...answers, [criterionId]: { ...answers[criterionId], note } };
    setAnswers(next);
    scheduleSave(payload({ answers: next }));
  };
  const onCommentBlur = () => {
    if (timer.current) clearTimeout(timer.current);
    void flush(payload());
  };

  const toggleNa = async (checked: boolean) => {
    setNa(checked);
    setSave("saving");
    const res = await setNaAction(props.evaluationId, props.subjectEmpId, checked);
    setSave(res.ok ? "saved" : "error");
    router.refresh();
  };

  const done = comment.trim().length > 0;
  const saveLabel =
    save === "saving" ? t("eval.saving") : save === "saved" ? t("eval.saved") : save === "error" ? t("eval.saveFailed") : "";

  return (
    <div className="space-y-5">
      {/* status line */}
      <div className="flex items-center justify-between text-sm">
        <span className={done && !na ? "font-medium text-green-600" : "text-muted"}>
          {na ? t("eval.markedNa") : done ? t("eval.done") : t("eval.notStarted")}
        </span>
        {props.editable && <span aria-live="polite" className="text-xs text-muted">{saveLabel}</span>}
      </div>

      {!props.editable && <p className="alert-info text-sm">{t("eval.readOnly")}</p>}

      {/* N/A toggle */}
      {!props.isSelf && (
        <label className="card flex items-center gap-3 p-4 text-sm">
          <input type="checkbox" checked={na} disabled={!props.editable} onChange={(e) => toggleNa(e.target.checked)} />
          <span className="font-medium text-ink">{t("eval.cantEvaluate")}</span>
        </label>
      )}

      {!na && (
        <>
          {props.pillars.map((p) => (
            <section key={p.pillarId} className="card space-y-4 p-4">
              <h2 className="text-sm font-semibold text-ink">{p.name}</h2>
              {p.criteria.map((c) => (
                <div key={c.criterionId} className="space-y-1.5 border-t border-line pt-3 first:border-0 first:pt-0">
                  <p className="text-sm font-medium text-ink">{c.title}</p>
                  {c.text && c.text !== c.title && <p className="text-xs text-muted">{c.text}</p>}
                  <StarRating value={answers[c.criterionId]?.level ?? null} disabled={!props.editable} onChange={(v) => setLevel(c.criterionId, v)} />
                  <input
                    className="input mt-1 text-sm"
                    placeholder={t("eval.notePlaceholder")}
                    disabled={!props.editable}
                    defaultValue={answers[c.criterionId]?.note ?? ""}
                    onBlur={(e) => setNote(c.criterionId, e.target.value)}
                  />
                </div>
              ))}
            </section>
          ))}

          {props.pillars.length === 0 && <p className="text-sm text-muted">{t("eval.noCriteria")}</p>}

          {/* Overall comment (required to be Done) */}
          <section className="card space-y-2 p-4">
            <label className="label">
              {t("eval.overallComment")} <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted">{t("eval.overallCommentHint")}</p>
            <textarea
              className="input"
              rows={3}
              disabled={!props.editable}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={onCommentBlur}
            />
          </section>
        </>
      )}

      {/* nav */}
      <div className="flex items-center justify-between">
        {props.prevHref ? (
          <Link href={props.prevHref} className="btn-sm border border-line">
            ← {t("eval.prevPerson")}
          </Link>
        ) : (
          <span />
        )}
        <Link href="/evaluation/evaluate" className="btn-sm border border-line">
          {t("eval.backToList")}
        </Link>
        {props.nextHref ? (
          <Link href={props.nextHref} className="btn-sm border border-line">
            {t("eval.nextPerson")} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
