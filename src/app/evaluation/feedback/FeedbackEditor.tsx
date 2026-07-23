"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { markdownToHtml } from "@/lib/evaluation/eval-ai-logic";
import type { FeedbackDetail } from "@/lib/evaluation/eval-feedback-service";
import { saveDraftAction, saveAdminNoteAction, overrideEffortAction, regenerateOneAction, releaseAction } from "./actions";

export function FeedbackEditor({ cycleId, detail }: { cycleId: number; detail: FeedbackDetail }) {
  const t = useT();
  const [md, setMd] = useState(detail.editedMd ?? detail.draftMd ?? "");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const hidden = (
    <>
      <input type="hidden" name="cycleId" value={cycleId} />
      <input type="hidden" name="empId" value={detail.subjectEmpId} />
    </>
  );
  const badge: Record<string, string> = {
    RELEASED: "bg-green-100 text-green-700",
    GENERATED: "bg-blue-100 text-blue-700",
    GENERATING: "bg-amber-100 text-amber-700",
    FAILED: "bg-red-100 text-red-700",
    NOT_GENERATED: "bg-canvas text-muted",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded px-2 py-0.5 text-xs ${badge[detail.status] ?? badge.NOT_GENERATED}`}>{t(`eval.fbStatus.${detail.status}`)}</span>
        <div className="flex gap-2">
          <form action={regenerateOneAction}>
            {hidden}
            <button className="btn-sm border border-line">{t("eval.regenerate")}</button>
          </form>
          {(detail.status === "GENERATED" || detail.status === "RELEASED") && (
            <>
              <a href={`/api/evaluation/feedback/${cycleId}/${detail.subjectEmpId}/pdf`} className="btn-sm border border-line">
                ⬇ {t("eval.downloadPdf")}
              </a>
              <form action={releaseAction}>
                {hidden}
                <button className="btn-primary btn-sm">{detail.status === "RELEASED" ? t("eval.reRelease") : t("eval.approveRelease")}</button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Effort */}
      <form action={overrideEffortAction} className="card flex flex-wrap items-end gap-3 p-4">
        {hidden}
        <div className="text-sm">
          <span className="text-muted">{t("eval.effortCoverage")}: </span>
          <span className="font-medium text-ink">{detail.effortCoveragePct != null ? `${detail.effortCoveragePct}%` : "—"}</span>
          <span className="ms-3 text-muted">{t("eval.effortDepth")}: </span>
          <span className="font-medium text-ink">{detail.effortDepth != null ? `${detail.effortDepth}/20` : "—"}</span>
        </div>
        <div className="min-w-[8rem]">
          <label className="label">{t("eval.effortScoreOverride")}</label>
          <input name="effortScore" type="number" min={0} max={100} defaultValue={detail.effortScore ?? ""} className="input" />
        </div>
        <button className="btn-sm border border-line">{t("common.save")}</button>
      </form>

      {/* Report editor (edit-then-render) */}
      <div className="card p-4">
        <div className="mb-2 flex gap-2 border-b border-line">
          {(["edit", "preview"] as const).map((x) => (
            <button key={x} type="button" onClick={() => setTab(x)} className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${tab === x ? "border-brand font-medium text-brand" : "border-transparent text-muted"}`}>
              {t(x === "edit" ? "eval.edit" : "eval.preview")}
            </button>
          ))}
        </div>
        {detail.draftMd == null ? (
          <p className="text-sm text-muted">{t("eval.notGeneratedYet")}</p>
        ) : (
          <form action={saveDraftAction} className="space-y-2">
            {hidden}
            <textarea
              name="editedMd"
              value={md}
              onChange={(e) => setMd(e.target.value)}
              rows={16}
              className={`input font-mono text-sm ${tab === "edit" ? "" : "hidden"}`}
            />
            {tab === "preview" && (
              <div className="doc-content prose-sm max-w-none rounded border border-line p-3 text-ink" dangerouslySetInnerHTML={{ __html: markdownToHtml(md) }} />
            )}
            <button className="btn-primary btn-sm">{t("eval.saveDraft")}</button>
          </form>
        )}
      </div>

      {/* Admin note (context for regeneration) */}
      <form action={saveAdminNoteAction} className="card space-y-2 p-4">
        {hidden}
        <label className="label">{t("eval.adminNote")}</label>
        <p className="text-xs text-muted">{t("eval.adminNoteHint")}</p>
        <textarea name="adminNote" defaultValue={detail.adminNote ?? ""} rows={2} className="input" />
        <button className="btn-sm border border-line">{t("common.save")}</button>
      </form>
    </div>
  );
}
