"use client";
import { useT } from "@/i18n/client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-md space-y-4 p-6 text-center">
        <div className="text-3xl">⚠️</div>
        <h1 className="text-lg font-semibold text-ink">{t("state.errorTitle")}</h1>
        <p className="text-sm text-muted">{t("state.errorBody")}</p>
        <div className="flex justify-center gap-2">
          <button type="button" className="btn-primary" onClick={reset}>{t("common.retry")}</button>
          <a href="/" className="btn-secondary">{t("common.goHome")}</a>
        </div>
      </div>
    </div>
  );
}
