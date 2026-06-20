// Shared return type for "Save all"-style server actions used with <ActionForm>
// (React useActionState). `n` is a monotonically-increasing save counter — the
// form keys off it to remount and reflect freshly-revalidated data after a save.

export type SaveState = { ok: boolean; n: number; error?: string } | null;

/** Success: bump the save counter so the form remounts with the revalidated data. */
export function saved(prev: SaveState): SaveState {
  return { ok: true, n: (prev?.n ?? 0) + 1 };
}

/** Failure: keep the counter (no remount) so the user's in-progress edits survive.
 *  `error` is an i18n key shown by <ActionForm>. */
export function saveError(prev: SaveState, error = "common.saveError"): SaveState {
  return { ok: false, n: prev?.n ?? 0, error };
}
