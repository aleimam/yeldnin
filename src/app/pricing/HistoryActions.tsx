"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { hardDeleteCalculationAction, purgeHistoryAction } from "./actions";

/** Permanent single-row delete (managers only). Double-confirm. */
export function HardDeleteButton({ id }: { id: number }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("pricer.deletePermanentConfirm"))) return;
        if (!confirm(t("pricer.deletePermanentConfirm2"))) return;
        start(() => hardDeleteCalculationAction(id));
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {t("pricer.deletePermanent")}
    </button>
  );
}

/** Wipe the entire history (managers only). Double-confirm. */
export function PurgeHistoryButton() {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("pricer.purgeConfirm"))) return;
        if (!confirm(t("pricer.purgeConfirm2"))) return;
        start(async () => {
          await purgeHistoryAction();
          router.refresh();
        });
      }}
      className="btn-secondary text-red-600"
    >
      {pending ? "…" : t("pricer.purgeAll")}
    </button>
  );
}
