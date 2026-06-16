"use client";
import { useActionState } from "react";
import { saveProfileAction, type FormState } from "../actions";

const initial: FormState = {};

export function ProfileForm({
  user,
}: {
  user: { id: number; name: string; fullName: string; email: string; tier: string; active: boolean };
}) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);

  return (
    <form action={action} className="card space-y-4 p-6">
      <h2 className="font-semibold text-ink">Profile</h2>
      <input type="hidden" name="id" value={user.id} />
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Saved.
        </div>
      )}
      <div>
        <label htmlFor="name" className="label">Display name</label>
        <input id="name" name="name" className="input" defaultValue={user.name} required />
      </div>
      <div>
        <label htmlFor="fullName" className="label">Full name (official)</label>
        <input id="fullName" name="fullName" className="input" defaultValue={user.fullName} />
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" className="input" defaultValue={user.email} required />
      </div>
      <div>
        <label htmlFor="tier" className="label">Tier</label>
        <select id="tier" name="tier" className="input" defaultValue={user.tier}>
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="active" defaultChecked={user.active} />
        Active
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
