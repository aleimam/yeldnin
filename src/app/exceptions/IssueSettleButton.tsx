"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { settleIssueAction } from "./actions";

/** Settle a loss Issue (compensated / no compensation) from the Issue page. */
export function IssueSettleButton({ issueId }: { issueId: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<"COMPENSATED" | "NO_COMPENSATION">("COMPENSATED");

  return (
    <span className="flex items-center gap-2">
      <select className="input h-9 w-44 py-0 text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value as "COMPENSATED" | "NO_COMPENSATION")} disabled={pending}>
        <option value="COMPENSATED">{t("exceptions.outcome.COMPENSATED")}</option>
        <option value="NO_COMPENSATION">{t("exceptions.outcome.NO_COMPENSATION")}</option>
      </select>
      <button
        type="button"
        className="btn-primary px-3 py-1.5 text-sm"
        disabled={pending}
        onClick={() => start(async () => { await settleIssueAction(issueId, outcome); router.refresh(); })}
      >
        {t("exceptions.action.close")}
      </button>
    </span>
  );
}
