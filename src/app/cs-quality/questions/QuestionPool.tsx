"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { clampWeight } from "@/lib/cs/cs-logic";
import { createCsQuestionAction, updateCsQuestionAction, archiveCsQuestionAction } from "../actions";

type TypeOpt = { id: number; name: string; scope: string };
type Q = { id: number; criteria: string; weight: number; scope: string; typeId: number; active: boolean; typeName: string };

const blank = { criteria: "", scope: "CALL", typeId: "", weight: "5", active: true };

export function QuestionPool({ questions, types }: { questions: Q[]; types: TypeOpt[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [f, setF] = useState({ ...blank });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const typesForScope = types.filter((ty) => ty.scope === f.scope);

  function reset() {
    setEditingId(null);
    setF({ ...blank });
    setError("");
  }
  function edit(q: Q) {
    setEditingId(q.id);
    setF({ criteria: q.criteria, scope: q.scope, typeId: String(q.typeId), weight: String(q.weight), active: q.active });
    setError("");
  }
  function submit() {
    setError("");
    const payload = { criteria: f.criteria, weight: clampWeight(Number(f.weight)), scope: f.scope, typeId: Number(f.typeId), active: f.active };
    start(async () => {
      const res = editingId ? await updateCsQuestionAction(editingId, payload) : await createCsQuestionAction(payload);
      if (res.ok) {
        reset();
        router.refresh();
      } else setError(res.error);
    });
  }
  function archive(id: number) {
    if (!confirm(t("cs.archiveQuestionConfirm"))) return;
    start(async () => {
      await archiveCsQuestionAction(id);
      router.refresh();
    });
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Add / edit form */}
      <form className="card space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <h2 className="font-semibold text-ink">{editingId ? t("cs.editQuestion") : t("cs.addQuestion")}</h2>
        <div>
          <label className="label">{t("cs.criteria")}</label>
          <textarea className="input" rows={2} value={f.criteria} onChange={(e) => set("criteria", e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">{t("cs.scope")}</label>
            <select className="input" value={f.scope} onChange={(e) => { set("scope", e.target.value); set("typeId", ""); }}>
              <option value="CALL">{t("cs.scope.CALL")}</option>
              <option value="PERIODICAL">{t("cs.scope.PERIODICAL")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("cs.type")}</label>
            <select className="input" value={f.typeId} onChange={(e) => set("typeId", e.target.value)}>
              <option value="">…</option>
              {typesForScope.map((ty) => <option key={ty.id} value={ty.id}>{ty.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("cs.weight")}</label>
            <input type="number" min={1} max={10} className="input" value={f.weight} onChange={(e) => set("weight", e.target.value)} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-ink">
            <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
            {t("cs.active")}
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn-primary">{pending ? "…" : editingId ? t("common.save") : t("cs.addQuestion")}</button>
          {editingId && <button type="button" onClick={reset} className="btn-secondary">{t("common.cancel")}</button>}
        </div>
      </form>

      {/* List */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("cs.criteria")}</th>
              <th className="th">{t("cs.scope")}</th>
              <th className="th">{t("cs.type")}</th>
              <th className="th text-end">{t("cs.weight")}</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {questions.map((q) => (
              <tr key={q.id} className={q.active ? "" : "opacity-50"}>
                <td className="td">{q.criteria}{!q.active && <span className="ms-2 text-xs text-muted">({t("cs.inactive")})</span>}</td>
                <td className="td">{t(`cs.scope.${q.scope}`)}</td>
                <td className="td text-muted">{q.typeName}</td>
                <td className="td text-end">{q.weight}</td>
                <td className="td text-end whitespace-nowrap">
                  <button onClick={() => edit(q)} className="text-brand hover:underline">{t("common.edit")}</button>
                  <button onClick={() => archive(q.id)} className="ms-3 text-red-600 hover:underline">{t("common.delete")}</button>
                </td>
              </tr>
            ))}
            {questions.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("cs.noQuestions")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
