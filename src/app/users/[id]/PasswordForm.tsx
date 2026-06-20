"use client";
import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { setPasswordAction, type FormState } from "../actions";

const initial: FormState = {};

export function PasswordForm({ userId }: { userId: number }) {
  const t = useT();
  const [state, action, pending] = useActionState(setPasswordAction, initial);

  return (
    <form action={action} className="card space-y-4 p-6">
      <h2 className="font-semibold text-ink">{t("users.setPassword")}</h2>
      <input type="hidden" name="id" value={userId} />
      {state.error && (
        <div className="alert alert-error">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("users.passwordUpdated")}
        </div>
      )}
      <div>
        <label htmlFor="password" className="label">{t("users.newPassword")}</label>
        <input id="password" name="password" type="text" className="input" required />
        <p className="mt-1 text-xs text-muted">{t("users.passwordHint")}</p>
      </div>
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "…" : t("users.updatePassword")}
      </button>
    </form>
  );
}
