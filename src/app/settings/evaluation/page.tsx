import { requireAdmin } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { ActionForm } from "@/components/ActionForm";
import { getAiConfig } from "@/lib/evaluation/eval-ai-config-service";
import { saveAiConfigAction, testAiConfigAction } from "./actions";

export default async function AiSettingsPage() {
  const access = await requireAdmin();
  const t = await getT();
  const cfg = await getAiConfig();

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("eval.ai.settings")}>
      <div className="mx-auto max-w-xl space-y-5">
        <header>
          <h1 className="text-xl font-semibold text-ink">{t("eval.ai.settings")}</h1>
          <p className="text-sm text-muted">{t("eval.ai.hint")}</p>
        </header>

        <div className="card p-4">
          <p className="text-sm">
            <span className="text-muted">{t("common.status")}: </span>
            {cfg.configured ? (
              <span className="font-medium text-green-600">{t("eval.ai.configured")}{cfg.keyHint ? ` (${cfg.keyHint})` : ""}</span>
            ) : (
              <span className="font-medium text-amber-600">{t("eval.ai.notConfigured")}</span>
            )}
          </p>
          {cfg.lastTestOk != null && (
            <p className="mt-1 text-xs text-muted">
              {t("eval.ai.lastTest")}: {cfg.lastTestOk ? "✓" : "✗"} {cfg.lastTestMessage}
            </p>
          )}
        </div>

        <ActionForm action={saveAiConfigAction} className="card space-y-3 p-4">
          <div>
            <label className="label">{t("eval.ai.apiKey")}</label>
            <input name="apiKey" type="password" autoComplete="off" placeholder={cfg.configured ? "••••••••" : "sk-ant-…"} className="input" />
            <p className="mt-1 text-xs text-muted">{t("eval.ai.apiKeyHint")}</p>
          </div>
          <div>
            <label className="label">{t("eval.ai.model")}</label>
            <input name="model" defaultValue={cfg.model} className="input" />
            <p className="mt-1 text-xs text-muted">{t("eval.ai.modelHint")}</p>
          </div>
        </ActionForm>

        {cfg.configured && (
          <form action={testAiConfigAction}>
            <button className="btn-sm border border-line">{t("eval.ai.test")}</button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
