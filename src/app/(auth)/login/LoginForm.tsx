"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

// Remember the identifier across a failed attempt — client-side only, never in
// the URL (it's mildly personal). Cleared once the field is repopulated.
const KEY = "yeldnin_login_id";

export function LoginForm() {
  const t = useT();
  const [pending, setPending] = useState(false);
  const idRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY);
    if (saved && idRef.current && !idRef.current.value) idRef.current.value = saved;
  }, []);

  return (
    <form
      method="POST"
      action="/api/login"
      className="space-y-4"
      onSubmit={() => {
        if (idRef.current) sessionStorage.setItem(KEY, idRef.current.value);
        setPending(true);
      }}
    >
      <div>
        <label htmlFor="identifier" className="label">{t("login.identifier")} *</label>
        <input id="identifier" name="identifier" type="text" autoComplete="username" required ref={idRef} className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">{t("login.password")} *</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? `${t("login.submit")}…` : t("login.submit")}
      </button>
    </form>
  );
}
