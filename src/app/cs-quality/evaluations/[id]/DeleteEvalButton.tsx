"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
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
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "…" : t("cs.deleteEval")}
    </button>
  );
}
