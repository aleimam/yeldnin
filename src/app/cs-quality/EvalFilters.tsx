"use client";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

type Current = { month: string; evaluator: string; reviewee: string };
type Opt = { id: number; name: string };

/** Month + evaluator + reviewee filters for the evaluation lists. State lives in
 *  the URL (?month=&evaluator=&reviewee=) so it survives reload + is shareable.
 *  Pass an empty options array to hide that dropdown (e.g. evaluator on "Submitted"). */
export function EvalFilters({
  basePath,
  current,
  evaluators,
  reviewees,
}: {
  basePath: string;
  current: Current;
  evaluators: Opt[];
  reviewees: Opt[];
}) {
  const t = useT();
  const router = useRouter();

  const push = (next: Partial<Current>) => {
    const merged = { ...current, ...next };
    const params = new URLSearchParams();
    if (merged.month) params.set("month", merged.month);
    if (merged.evaluator) params.set("evaluator", merged.evaluator);
    if (merged.reviewee) params.set("reviewee", merged.reviewee);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input
        type="month"
        className="input"
        aria-label={t("cs.month")}
        value={current.month}
        onChange={(e) => push({ month: e.target.value })}
      />
      {reviewees.length > 0 && (
        <select className="input" aria-label={t("cs.salesRep")} value={current.reviewee} onChange={(e) => push({ reviewee: e.target.value })}>
          <option value="">{t("cs.allReviewees")}</option>
          {reviewees.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      )}
      {evaluators.length > 0 && (
        <select className="input" aria-label={t("cs.evaluator")} value={current.evaluator} onChange={(e) => push({ evaluator: e.target.value })}>
          <option value="">{t("cs.allEvaluators")}</option>
          {evaluators.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      )}
      {(current.month || current.evaluator || current.reviewee) && (
        <button type="button" onClick={() => router.push(basePath)} className="btn-secondary btn-sm justify-self-start">
          {t("cs.clearFilters")}
        </button>
      )}
    </div>
  );
}
