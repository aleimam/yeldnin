"use client";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { CS_LEVELS, valueFor, weightedTotal, normalizedPct, type ValueMap } from "@/lib/cs/cs-logic";
import { createCsEvaluationAction } from "../actions";

type Q = { id: number; criteria: string; weight: number; typeId: number; typeName: string };
type Rep = { id: number; name: string };
type CallType = { id: number; name: string };

// Catastrophe red … Outstanding green; middle three neutral.
const TONE: Record<string, string> = {
  CATASTROPHE: "border-red-400 bg-red-50 text-red-700",
  BAD: "border-line text-ink",
  GOOD: "border-line text-ink",
  PERFECT: "border-line text-ink",
  OUTSTANDING: "border-green-400 bg-green-50 text-green-700",
};

export function EvalForm({
  scope,
  reps,
  questions,
  callTypes,
  valueMap,
}: {
  scope: "CALL" | "PERIODICAL";
  reps: Rep[];
  questions: Q[];
  callTypes: CallType[];
  valueMap: ValueMap;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subjectId, setSubjectId] = useState("");
  const [callTypeId, setCallTypeId] = useState(scope === "CALL" && callTypes[0] ? String(callTypes[0].id) : "");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [error, setError] = useState("");

  const shown = useMemo(
    () => (scope === "CALL" ? questions.filter((q) => String(q.typeId) === callTypeId) : questions),
    [scope, questions, callTypeId],
  );
  const scored = shown.filter((q) => answers[q.id]).map((q) => ({ weight: q.weight, value: valueFor(valueMap, answers[q.id]) }));
  const total = weightedTotal(scored);
  const normalized = normalizedPct(scored, valueMap);
  const answeredCount = shown.filter((q) => answers[q.id]).length;
  const allAnswered = shown.length > 0 && answeredCount === shown.length;
  const callTypeName = callTypes.find((c) => String(c.id) === callTypeId)?.name ?? null;

  function submit() {
    setError("");
    if (!subjectId) return setError(t("cs.pickRep"));
    if (!allAnswered) return setError(t("cs.answerAll"));
    start(async () => {
      const res = await createCsEvaluationAction({
        subjectUserId: Number(subjectId),
        scope,
        typeName: scope === "CALL" ? callTypeName : null,
        answers: shown.map((q) => ({ questionId: q.id, level: answers[q.id], note: notes[q.id] || undefined })),
        photoIds: photos.map((p) => p.id),
      });
      if (res.ok) router.push("/cs-quality");
      else setError(res.error);
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="label">{t("cs.salesRep")}</label>
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">…</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {scope === "CALL" && (
          <div>
            <label className="label">{t("cs.callType")}</label>
            <select className="input" value={callTypeId} onChange={(e) => { setCallTypeId(e.target.value); setAnswers({}); }}>
              {callTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="card p-6 text-sm text-muted">{t("cs.noQuestionsForScope")}</div>
      ) : (
        shown.map((q) => (
          <div key={q.id} className="card space-y-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-ink">{q.criteria}</p>
              <span className="shrink-0 text-xs text-muted">{q.typeName} · ×{q.weight}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CS_LEVELS.map((lvl) => {
                const on = answers[q.id] === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setAnswers((p) => ({ ...p, [q.id]: lvl }))}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${TONE[lvl]} ${on ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100"}`}
                  >
                    {t(`cs.level.${lvl}`)}
                  </button>
                );
              })}
            </div>
            <input
              className="input text-sm"
              placeholder={t("cs.note")}
              value={notes[q.id] ?? ""}
              onChange={(e) => setNotes((p) => ({ ...p, [q.id]: e.target.value }))}
            />
          </div>
        ))
      )}

      <div className="card space-y-3 p-5">
        <div>
          <label className="label">{t("cs.photos")}</label>
          <PhotoUpload photos={photos} onChange={setPhotos} />
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-3 text-sm">
          <span className="text-muted">{t("cs.answered")}: <span className="text-ink">{answeredCount}/{shown.length}</span></span>
          <span className="text-muted">{t("cs.score")}: <span className="font-semibold text-ink">{total}</span></span>
          <span className="text-muted">{t("cs.normalized")}: <span className="font-semibold text-ink">{normalized}%</span></span>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="button" onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : t("cs.submitEval")}</button>
      </div>
    </div>
  );
}
