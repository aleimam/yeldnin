"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { saveProfileAction } from "../actions";

export interface ProfileUser {
  id: number;
  name: string;
  fullName: string;
  username: string;
  email: string;
  tier: string;
  active: boolean;
  primaryPhone: string;
  secondaryPhone: string;
  yeldnPhone: string;
  avatarUrl: string | null; // asset id
}

export function ProfileForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState(user.active);
  const [avatar, setAvatar] = useState<UploadedPhoto | null>(
    user.avatarUrl ? { id: user.avatarUrl, url: `/api/asset/${user.avatarUrl}` } : null,
  );
  const [f, setF] = useState({
    name: user.name,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    tier: user.tier,
    primaryPhone: user.primaryPhone,
    secondaryPhone: user.secondaryPhone,
    yeldnPhone: user.yeldnPhone,
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await saveProfileAction({ id: user.id, active, ...f, avatarId: avatar?.id ?? null });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-semibold text-ink">Profile</h2>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {saved && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Full name (official)"><input className="input" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
        <Field label="Username (for login)"><input className="input" value={f.username} onChange={(e) => set("username", e.target.value)} /></Field>
        <Field label="Email"><input type="email" className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Tier">
          <select className="input" value={f.tier} onChange={(e) => set("tier", e.target.value)}>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </Field>
        <Field label="Primary phone"><input className="input" value={f.primaryPhone} onChange={(e) => set("primaryPhone", e.target.value)} /></Field>
        <Field label="Secondary phone"><input className="input" value={f.secondaryPhone} onChange={(e) => set("secondaryPhone", e.target.value)} /></Field>
        <Field label="Yeldn phone"><input className="input" value={f.yeldnPhone} onChange={(e) => set("yeldnPhone", e.target.value)} /></Field>
      </div>

      <Field label="Avatar">
        <PhotoUpload photos={avatar ? [avatar] : []} onChange={(next) => setAvatar(next.at(-1) ?? null)} />
      </Field>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>

      <button onClick={submit} disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
