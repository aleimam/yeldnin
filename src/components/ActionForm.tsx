"use client";
import { useActionState } from "react";
import { useT } from "@/i18n/client";
import type { SaveState } from "@/lib/forms/action-state";

/**
 * Wraps a "Save all"-style server-action form and adds the two things a bare
 * `<form action>` lacks: a success/error note, and the saved data appearing
 * without a manual reload.
 *
 * The action returns a {@link SaveState} (use `saved()` / `saveError()`). On
 * success the action's `revalidatePath` re-renders the page, and because the save
 * counter `n` changed, the form remounts so new/edited rows show and the add-row
 * inputs reset — all in the single response useActionState commits. Works without
 * JS too (progressive enhancement); the note + remount are the enhanced path.
 */
export function ActionForm({
  action,
  children,
  className,
  saveLabel,
}: {
  action: (prev: SaveState, fd: FormData) => Promise<SaveState>;
  children: React.ReactNode;
  className?: string;
  saveLabel?: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form key={state?.n ?? 0} action={formAction} className={className}>
      {children}
      <div className="flex items-center gap-3 pt-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "…" : saveLabel ?? t("common.saveAll")}
        </button>
        {state?.ok && <span className="text-sm font-medium text-green-600" role="status">✓ {t("common.changesSaved")}</span>}
        {state && !state.ok && <span className="text-sm text-red-600" role="status">{t(state.error ?? "common.saveError")}</span>}
      </div>
    </form>
  );
}
