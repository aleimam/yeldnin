"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { TrashIcon } from "@/components/icons/TrashIcon";

/**
 * Confirm-then-delete button, rendered as a trash-can icon. `onDelete` is a bound
 * server action (e.g. `deleteCategoryAction.bind(null, id)`); on success the route
 * refreshes. Icon-only — the accessible label/tooltip is `common.delete`.
 */
export function DeleteButton({
  onDelete,
  confirmKey = "common.deleteConfirm",
  className = "text-red-600 hover:text-red-700 disabled:opacity-50",
  iconClassName = "h-4 w-4",
}: {
  onDelete: () => Promise<void>;
  confirmKey?: string;
  className?: string;
  iconClassName?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={t("common.delete")}
      aria-label={t("common.delete")}
      onClick={() => {
        if (!confirm(t(confirmKey))) return;
        start(async () => {
          await onDelete();
          router.refresh();
        });
      }}
      className={className}
    >
      {pending ? <span className="text-xs">…</span> : <TrashIcon className={iconClassName} />}
    </button>
  );
}
