"use client";
import { useState, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "@/i18n/client";
import { useUnsavedGuard } from "@/components/useUnsavedGuard";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { CS_LEVELS, CS_CHANNELS, valueFor, weightedTotal, normalizedPct, localized, type ValueMap } from "@/lib/cs/cs-logic";
import { createCsEvaluationAction, updateCsEvaluationAction } from "../actions";

type Q = { id: number; title: string; titleAr: string | null; criteria: string; criteriaAr: string | null; tags: string | null; tagsAr: string | null; weight: number; typeId: number; typeName: string; typeNameAr: string | null };
type Rep = { id: number; name: string };
type CallType = { id: number; name: string; nameAr: string | null };
export type EvalInitial = {
  subjectId: string;
  callTypeId: string;
  callDate: string;
  channel: string;
  contact: string;
  answers: Record<number, string>;
  notes: Record<number, string>;
  photos: UploadedPhoto[];
};

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
  evalId,
  initial,
}: {
  scope: "CALL" | "PERFORMANCE";
  reps: Rep[];
  questions: Q[];
  callTypes: CallType[];
  typeCount: number;
  valueMap: ValueMap;
  evalId?: number; // set → edit an existing evaluation instead of creating
  initial?: EvalInitial;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [callTypeId, setCallTypeId] = useState(initial?.callTypeId || (scope === "CALL" && callTypes[0] ? String(callTypes[0].id) : ""));
  const [callDate, setCallDate] = useState(initial?.callDate ?? today());
  const [channel, setChannel] = useState(initial?.channel ?? ""); // call-only
  const [contact, setContact] = useState(initial?.contact ?? ""); // call-only
  const [answers, setAnswers] = useState<Record<number, string>>(initial?.answers ?? {});
  const [notes, setNotes] = useState<Record<number, string>>(initial?.notes ?? {});
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initial?.photos ?? []);
  const [error, setError] = useState("");

  // Warn before navigating away with unsaved edits. The baseline is captured on
  // first render, so create-mode defaults (today's date, the sole call type) and
  // edit-mode initial values don't count as changes — only real edits do.
  const snapshot = JSON.stringify({ subjectId, callTypeId, callDate, channel, contact, answers, notes, photos });
  const baseline = useRef(snapshot);
  useUnsavedGuard(snapshot !== baseline.current, t("common.unsaved"));

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
    if (scope === "CALL" && !channel) return setError(t("cs.pickChannel"));
    if (scope === "CALL" && !contact.trim()) return setError(t("cs.enterContact"));
    if (!allAnswered) return setError(t("cs.answerAll"));
    const payload = {
      subjectUserId: Number(subjectId),
      scope,
      typeName: scope === "CALL" ? callTypeName : null,
      callDate,
      channel: scope === "CALL" ? channel || null : null,
      contact: scope === "CALL" ? contact || null : null,
      answers: shown.map((q) => ({ questionId: q.id, level: answers[q.id], note: notes[q.id] || undefined })),
      photoIds: photos.map((p) => p.id),
    };
    start(async () => {
      const res = evalId ? await updateCsEvaluationAction(evalId, payload) : await createCsEvaluationAction(payload);
      if (res.ok) router.push(evalId ? `/cs-quality/evaluations/${evalId}` : "/cs-quality");
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
              {callTypes.map((c) => <option key={c.id} value={c.id}>{localized(c.name, c.nameAr, locale)}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">{scope === "CALL" ? t("cs.callDate") : t("cs.evalDate")}</label>
          <input type="date" max={today()} className="input" value={callDate} onChange={(e) => setCallDate(e.target.value)} />
        </div>
        {scope === "CALL" && (
          <>
            <div>
              <label className="label">{t("cs.channel")}</label>
              <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="">—</option>
                {CS_CHANNELS.map((c) => <option key={c} value={c}>{t(`cs.channel.${c}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t("cs.contact")}</label>
              <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="card p-6 text-sm text-muted">{t("cs.noQuestionsForScope")}</div>
      ) : (
        shown.map((q) => (
          <div key={q.id} className="card space-y-3 p-4">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-ink">{localized(q.title, q.titleAr, locale)}</p>
                <span className="shrink-0 text-xs text-muted">{multiType ? `${localized(q.typeName, q.typeNameAr, locale)} · ` : ""}×{q.weight}</span>
              </div>
              {localized(q.criteria, q.criteriaAr, locale) && <p className="mt-0.5 text-sm text-muted">{localized(q.criteria, q.criteriaAr, locale)}</p>}
              {localized(q.tags ?? "", q.tagsAr, locale) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {localized(q.tags ?? "", q.tagsAr, locale).split(",").map((x) => x.trim()).filter(Boolean).map((tag) => (
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
        <button type="button" onClick={submit} disabled={pending || shown.length === 0} className="btn-primary">{pending ? "…" : evalId ? t("common.save") : t("cs.submitEval")}</button>
      </div>
    </div>
  );
}
