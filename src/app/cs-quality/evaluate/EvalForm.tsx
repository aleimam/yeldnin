"use client";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { CS_LEVELS, valueFor, weightedTotal, normalizedPct, type ValueMap } from "@/lib/cs/cs-logic";
import { createCsEvaluationAction } from "../actions";

type Q = { id: number; title: string; criteria: string; tags: string | null; weight: number; typeId: number; typeName: string };
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

const today = () => new Date().toISOString().slice(0, 10);

export function EvalForm({
  scope,
  reps,
  questions,
  callTypes,
  typeCount,
  valueMap,
}: {
  scope: "CALL" | "PERFORMANCE";
  reps: Rep[];
  questions: Q[];
  callTypes: CallType[];
  typeCount: number;
  valueMap: ValueMap;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subjectId, setSubjectId] = useState("");
  const [callTypeId, setCallTypeId] = useState(scope === "CALL" && callTypes[0] ? String(callTypes[0].id) : "");
  const [callDate, setCallDate] = useState(today());
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [error, setError] = useState("");
  // Type is only meaningful when a scope has more than one — otherwise hide picker & chip.
  const multiType = typeCount > 1;

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
    if (!callDate) return setError(t("cs.pickDate"));
    if (!allAnswered) return setError(t("cs.answerAll"));
    start(async () => {
      const res = await createCsEvaluationAction({
        subjectUserId: Number(subjectId),
        scope,
        typeName: scope === "CALL" ? callTypeName : null,
        callDate,
        answers: shown.map((q) => ({ questionId: q.id, level: answers[q.id], note: notes[q.id] || undefined })),
        photoIds: photos.map((p) => p.id),
      });
      if (res.ok) router.push("/cs-quality");
      else setError(res.error);
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="card grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <label className="label">{t("cs.salesRep")}</label>
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">…</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {scope === "CALL" && multiType && (
          <div>
            <label className="label">{t("cs.callType")}</label>
            <select className="input" value={callTypeId} onChange={(e) => { setCallTypeId(e.target.value); setAnswers({}); }}>
              {callTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">{scope === "CALL" ? t("cs.callDate") : t("cs.evalDate")}</label>
          <input type="date" max={today()} className="input" value={callDate} onChange={(e) => setCallDate(e.target.value)} />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card p-6 text-sm text-muted">{t("cs.noQuestionsForScope")}</div>
      ) : (
        shown.map((q) => (
          <div key={q.id} className="card space-y-3 p-4">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-ink">{q.title}</p>
                <span className="shrink-0 text-xs text-muted">{multiType ? `${q.typeName} · ` : ""}×{q.weight}</span>
              </div>
              {q.criteria && <p className="mt-0.5 text-sm text-muted">{q.criteria}</p>}
              {q.tags && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {q.tags.split(",").map((x) => x.trim()).filter(Boolean).map((tag) => (
                    <span key={tag} className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {CS_LEVELS.map((lvl) => {
                const on = answers[q.id] === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setAnswers((p) => ({ ...p, [q.id]: lvl }))}
                    className={`rounded-lg border px-1 py-1.5 text-center text-[11px] font-medium leading-tight transition ${TONE[lvl]} ${on ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100"}`}
                  >
                    {t(`cs.level.${lvl}`)}
                  </button>
                );
              })}
            </div>
            <input className="input text-sm" placeholder={t("cs.note")} value={notes[q.id] ?? ""} onChange={(e) => setNotes((p) => ({ ...p, [q.id]: e.target.value }))} />
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
        <button type="button" onClick={submit} disabled={pending || shown.length === 0} className="btn-primary">{pending ? "…" : t("cs.submitEval")}</button>
      </div>
    </div>
  );
}
