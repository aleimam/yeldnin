"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { COMPENSATION_TYPES } from "@/lib/issues/issues-logic";
import { AutoTextarea } from "@/components/AutoTextarea";
import { resolveIssueAction, reopenIssueAction, addCompensationAction } from "./actions";

/** Resolve / reopen an issue. */
export function IssueResolveButton({ id, status }: { id: number; status: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const fn = status === "OPEN" ? resolveIssueAction : reopenIssueAction;
  return (
    <button
      onClick={() => start(async () => { await fn(id); router.refresh(); })}
      disabled={pending}
      className={status === "OPEN" ? "btn-primary px-3 py-1.5 text-sm" : "btn-secondary px-3 py-1.5 text-sm"}
    >
      {pending ? "…" : status === "OPEN" ? t("issues.resolve") : t("issues.reopen")}
    </button>
  );
}

/** Add a compensation (money / product) to an issue. */
export function CompensationForm({ issueId }: { issueId: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("MONEY");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    setError(null);
    start(async () => {
      const res = await addCompensationAction({
        issueId,
        type,
        amountEgp: type === "MONEY" && amount ? Number(amount) : null,
        note: note || undefined,
      });
      if (res.ok) { setAmount(""); setNote(""); router.refresh(); } else setError(res.error ?? "Error");
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <div className="text-sm font-medium text-ink">{t("issues.addComp")}</div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select className="input h-8 max-w-[10rem] py-1" value={type} onChange={(e) => setType(e.target.value)}>
          {COMPENSATION_TYPES.map((c) => <option key={c} value={c}>{t(`comptype.${c}`)}</option>)}
        </select>
        {type === "MONEY" && (
          <input type="number" step="any" className="input h-8 w-32 py-1" placeholder={t("issues.amountEgp")} value={amount} onChange={(e) => setAmount(e.target.value)} />
        )}
        <AutoTextarea className="flex-1 py-1" placeholder={t("issues.compNote")} value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={submit} disabled={pending} className="btn-primary px-3 py-1.5 text-sm">{pending ? "…" : t("issues.add")}</button>
      </div>
      {type === "PRODUCT" && <p className="text-xs text-muted">{t("issues.productCompHint")}</p>}
    </div>
  );
}
