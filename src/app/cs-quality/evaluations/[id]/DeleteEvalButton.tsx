"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { TrashIcon } from "@/components/icons/TrashIcon";
import { deleteCsEvaluationAction } from "../../actions";

export function DeleteEvalButton({ id, backHref }: { id: number; backHref: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("cs.deleteEvalConfirm"))) return;
        start(async () => {
          await deleteCsEvaluationAction(id);
          router.push(backHref);
        });
      }}
      className="text-red-600 hover:text-red-700 disabled:opacity-50"
      title={t("cs.deleteEval")}
      aria-label={t("cs.deleteEval")}
    >
      {pending ? <span className="text-xs">…</span> : <TrashIcon className="h-4 w-4" />}
    </button>
  );
}
