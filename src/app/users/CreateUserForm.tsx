"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { createUserAction } from "./actions";

export function CreateUserForm() {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<UploadedPhoto | null>(null);
  const [f, setF] = useState({
    name: "",
    fullName: "",
    username: "",
    email: "",
    tier: "MEMBER",
    password: "",
    primaryPhone: "",
    secondaryPhone: "",
    yeldnPhone: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    start(async () => {
      const res = await createUserAction({ ...f, avatarId: avatar?.id ?? null });
      if (res.ok) router.push(`/users/${res.id}`);
      else {
        setError(res.error);
        set("password", ""); // keep every other field; clear only the password
      }
    });
  }

  return (
    <div className="card max-w-2xl space-y-4 p-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("users.name")}><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label={t("users.fullName")}><input className="input" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
        <Field label={t("users.username")}><input className="input" value={f.username} onChange={(e) => set("username", e.target.value)} /></Field>
        <Field label={t("users.email")}><input type="email" className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label={t("users.tier")}>
          <select className="input" value={f.tier} onChange={(e) => set("tier", e.target.value)}>
            <option value="MEMBER">{t("tier.MEMBER")}</option>
            <option value="ADMIN">{t("tier.ADMIN")}</option>
            <option value="SUPER_ADMIN">{t("tier.SUPER_ADMIN")}</option>
          </select>
        </Field>
        <Field label={t("users.initialPassword")}>
          <input type="text" className="input" value={f.password} onChange={(e) => set("password", e.target.value)} />
          <p className="mt-1 text-xs text-muted">{t("users.passwordHint")}</p>
        </Field>
        <Field label={t("users.primaryPhone")}><input className="input" value={f.primaryPhone} onChange={(e) => set("primaryPhone", e.target.value)} /></Field>
        <Field label={t("users.secondaryPhone")}><input className="input" value={f.secondaryPhone} onChange={(e) => set("secondaryPhone", e.target.value)} /></Field>
        <Field label={t("users.yeldnPhone")}><input className="input" value={f.yeldnPhone} onChange={(e) => set("yeldnPhone", e.target.value)} /></Field>
      </div>

      <Field label={t("users.avatar")}>
        <PhotoUpload photos={avatar ? [avatar] : []} onChange={(next) => setAvatar(next.at(-1) ?? null)} />
      </Field>

      <button onClick={submit} disabled={pending} className="btn-primary">
        {pending ? "…" : t("users.createUser")}
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
