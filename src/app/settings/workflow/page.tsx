import { requireAdmin } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import {
  ITEM_STATUS_ORDER,
  DEFAULT_LABELS,
  CONTAINER_VIEW_MAP,
  resolveWorkflow,
} from "@/lib/workflow/workflow-logic";
import { getWorkflowOverrides } from "@/lib/workflow/workflow-config-service";
import { StatusMapEditor, type StatusRow } from "./StatusMapEditor";

const containerLabel = (v: string) => v[0] + v.slice(1).toLowerCase();

export default async function WorkflowPage() {
  const access = await requireAdmin();
  const [t, overrides] = await Promise.all([getT(), getWorkflowOverrides()]);
  const w = resolveWorkflow(overrides);

  const rows: StatusRow[] = ITEM_STATUS_ORDER.map((key) => {
    const cv = CONTAINER_VIEW_MAP[key];
    return {
      key,
      defaultEn: DEFAULT_LABELS[key].en,
      defaultAr: DEFAULT_LABELS[key].ar,
      en: w.label(key, "en"),
      ar: w.label(key, "ar"),
      hideNormal: w.carryForward.SALES_NORMAL.has(key),
      hideSpecial: w.carryForward.SALES_SPECIAL.has(key),
      containers: cv
        ? Object.entries(cv)
            .map(([view, label]) => `${containerLabel(view)}: ${label}`)
            .join(" · ")
        : "",
    };
  });

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("workflow.title")} backHref="/settings">
      <div className="max-w-5xl space-y-4">
        <p className="text-sm text-muted">{t("workflow.intro")}</p>
        <StatusMapEditor rows={rows} timers={w.timers} />
      </div>
    </AppShell>
  );
}
