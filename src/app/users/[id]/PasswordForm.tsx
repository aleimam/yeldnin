"use client";
import { useActionState } from "react";
import { setPasswordAction, type FormState } from "../actions";

const initial: FormState = {};

export function PasswordForm({ userId }: { userId: number }) {
  const [state, action, pending] = useActionState(setPasswordAction, initial);

  return (
    <form action={action} className="card space-y-4 p-6">
      <h2 className="font-semibold text-ink">Set password</h2>
      <input type="hidden" name="id" value={userId} />
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Password updated.
        </div>
      )}
      <div>
        <label htmlFor="password" className="label">New password</label>
        <input id="password" name="password" type="text" className="input" required />
        <p className="mt-1 text-xs text-muted">
          Min 8 chars, with a letter, a digit, and a symbol.
        </p>
      </div>
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
