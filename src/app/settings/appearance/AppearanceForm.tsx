"use client";
import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { THEMES } from "@/lib/theme";
import { saveAppearanceAction, type FormState } from "./actions";

const initial: FormState = {};

function CurrentImage({ src, label }: { src: string | null; label: string }) {
  return (
    <div className="mb-2 flex h-12 items-center">
      {src ? (
        <img src={src} alt={label} className="max-h-12 max-w-[160px] object-contain" />
      ) : (
        <span className="text-xs text-muted">— none —</span>
      )}
    </div>
  );
}

export function AppearanceForm({
  current,
}: {
  current: {
    appName: string;
    themeKey: string;
    logoUrl: string | null;
    darkLogoUrl: string | null;
    faviconUrl: string | null;
  };
}) {
  const t = useT();
  const [state, action, pending] = useActionState(saveAppearanceAction, initial);

  return (
    <form action={action} className="card max-w-2xl space-y-6 p-6">
      {state.error && (
        <div className="alert alert-error">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("settings.appearance.saved")}
        </div>
      )}

      <div>
        <label htmlFor="appName" className="label">{t("settings.appearance.appName")}</label>
        <input id="appName" name="appName" className="input" defaultValue={current.appName} />
      </div>

      <div>
        <label htmlFor="themeKey" className="label">{t("settings.appearance.defaultTheme")}</label>
        <select id="themeKey" name="themeKey" className="input max-w-xs" defaultValue={current.themeKey}>
          {THEMES.map((th) => (
            <option key={th.key} value={th.key}>{th.name}</option>
          ))}
        </select>
        <div className="mt-2 flex gap-2">
          {THEMES.map((th) => (
            <span key={th.key} className="h-5 w-5 rounded-full" style={{ background: th.swatch }} title={th.name} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <label htmlFor="logo" className="label">{t("settings.appearance.logo")}</label>
          <CurrentImage src={current.logoUrl} label="logo" />
          <input id="logo" name="logo" type="file" accept="image/*" className="text-xs" />
        </div>
        <div>
          <label htmlFor="darkLogo" className="label">{t("settings.appearance.darkLogo")}</label>
          <div className="rounded-lg bg-slate-900 p-1">
            <CurrentImage src={current.darkLogoUrl} label="dark logo" />
          </div>
          <input id="darkLogo" name="darkLogo" type="file" accept="image/*" className="mt-1 text-xs" />
        </div>
        <div>
          <label htmlFor="favicon" className="label">{t("settings.appearance.favicon")}</label>
          <CurrentImage src={current.faviconUrl} label="favicon" />
          <input id="favicon" name="favicon" type="file" accept="image/*" className="text-xs" />
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : t("common.save")}
      </button>
    </form>
  );
}
