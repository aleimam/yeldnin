"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

/**
 * Confirm-then-delete button. `onDelete` is a bound server action
 * (e.g. `deleteCategoryAction.bind(null, id)`); on success the route refreshes.
 */
export function DeleteButton({
  onDelete,
  confirmKey = "common.deleteConfirm",
  className = "text-sm text-red-600 hover:underline disabled:opacity-50",
}: {
  onDelete: () => Promise<void>;
  confirmKey?: string;
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t(confirmKey))) return;
        start(async () => {
          await onDelete();
          router.refresh();
        });
      }}
      className={className}
    >
      {pending ? "…" : t("common.delete")}
    </button>
  );
}
