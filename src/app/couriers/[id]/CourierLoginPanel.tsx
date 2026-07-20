"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { validatePin, PIN_MIN, PIN_MAX } from "@/lib/couriers/courier-login-logic";
import { createCourierLoginAction, resetCourierPinAction, setCourierLoginActiveAction } from "../actions";

interface Login {
  phone: string;
  active: boolean;
  locked: boolean;
}

export function CourierLoginPanel({ courierId, canManage, login }: { courierId: number; canManage: boolean; login: Login | null }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [resetting, setResetting] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? t("dlv.login.failed"));
      else {
        setPhone("");
        setPin("");
        setResetting(false);
        router.refresh();
      }
    });
  };

  // Live PIN hint so a courier-manager isn't guessing the policy.
  const pinErr = pin ? validatePin(pin) : null;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("dlv.login.title")}</h2>
        {login && (
          <span className={`rounded px-2 py-0.5 text-xs ${login.active ? "bg-green-50 text-green-700" : "bg-canvas text-muted"}`}>
            {login.active ? t("dlv.login.active") : t("dlv.login.disabled")}
          </span>
        )}
      </div>

      <p className="text-xs text-muted">{t("dlv.login.hint")}</p>

      {!login && !canManage && <p className="text-sm text-muted">{t("dlv.login.none")}</p>}

      {/* ── No login yet: create one ── */}
      {!login && canManage && (
        <div className="space-y-3">
          <div>
            <label className="label">{t("dlv.login.phone")}</label>
            <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01001234567" />
          </div>
          <div>
            <label className="label">{t("dlv.login.pin")}</label>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_MAX}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={`${PIN_MIN}–${PIN_MAX} ${t("dlv.login.digits")}`}
            />
            {pinErr && <p className="mt-1 text-xs text-amber-700">{pinErr}</p>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            className="btn-primary"
            disabled={pending || !phone || !pin || !!pinErr}
            onClick={() => run(() => createCourierLoginAction(courierId, phone, pin))}
          >
            {pending ? "…" : t("dlv.login.create")}
          </button>
        </div>
      )}

      {/* ── Login exists ── */}
      {login && (
        <div className="space-y-3">
          <div className="flex justify-between border-b border-line py-2 text-sm">
            <span className="text-muted">{t("dlv.login.phone")}</span>
            <span dir="ltr">{login.phone}</span>
          </div>
          {login.locked && <p className="text-xs text-amber-700">{t("dlv.login.locked")}</p>}

          {canManage && (
            <>
              {resetting ? (
                <div className="space-y-2">
                  <label className="label">{t("dlv.login.newPin")}</label>
                  <input
                    className="input"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={PIN_MAX}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                  {pinErr && <p className="text-xs text-amber-700">{pinErr}</p>}
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      className="btn-primary"
                      disabled={pending || !pin || !!pinErr}
                      onClick={() => run(() => resetCourierPinAction(courierId, pin))}
                    >
                      {pending ? "…" : t("dlv.login.saveNewPin")}
                    </button>
                    <button className="btn-secondary btn-sm" disabled={pending} onClick={() => { setResetting(false); setPin(""); setError(null); }}>
                      {t("dlv.login.cancel")}
                    </button>
                  </div>
                  <p className="text-xs text-muted">{t("dlv.login.resetWarn")}</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary btn-sm" disabled={pending} onClick={() => setResetting(true)}>
                    {t("dlv.login.reset")}
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    disabled={pending}
                    onClick={() => run(() => setCourierLoginActiveAction(courierId, !login.active))}
                  >
                    {login.active ? t("dlv.login.disable") : t("dlv.login.enable")}
                  </button>
                </div>
              )}
              {!resetting && error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
