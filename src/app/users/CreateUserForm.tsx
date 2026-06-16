"use client";
import { useActionState } from "react";
import { createUserAction, type FormState } from "./actions";

const initial: FormState = {};

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);

  return (
    <form action={action} className="card max-w-lg space-y-4 p-6">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <div>
        <label htmlFor="name" className="label">Display name</label>
        <input id="name" name="name" className="input" required />
      </div>
      <div>
        <label htmlFor="fullName" className="label">Full name (official)</label>
        <input id="fullName" name="fullName" className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" className="input" required />
      </div>
      <div>
        <label htmlFor="tier" className="label">Tier</label>
        <select id="tier" name="tier" className="input" defaultValue="MEMBER">
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>
      <div>
        <label htmlFor="password" className="label">Initial password</label>
        <input id="password" name="password" type="text" className="input" required />
        <p className="mt-1 text-xs text-muted">
          Min 8 chars, with a letter, a digit, and a symbol.
        </p>
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}
