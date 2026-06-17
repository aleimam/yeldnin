import { requireAdmin } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { getNotifyRules } from "@/lib/notify/notify-config-service";
import { NOTIFY_EVENTS } from "@/lib/notify/notify-logic";
import { MAIN_MODULES } from "@/lib/modules";
import { ITEM_STATUS_ORDER } from "@/lib/workflow/workflow-logic";
import { getWorkflow } from "@/lib/workflow/workflow-config-service";
import { NotificationMatrix } from "./NotificationMatrix";

export default async function NotificationsSettingsPage() {
  const access = await requireAdmin();
  const [t, locale, rulesMap, wf] = await Promise.all([getT(), getLocale(), getNotifyRules(), getWorkflow()]);
  const loc = locale === "ar" ? "ar" : "en";
  const rules = NOTIFY_EVENTS.map((e) => rulesMap[e.key]);
  const modules = MAIN_MODULES.map((m) => ({ key: m.key, label: t(`module.${m.key}.name`) }));
  const statuses = ITEM_STATUS_ORDER.map((s) => ({ value: s, label: wf.label(s, loc) }));

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("notifyrules.title")} backHref="/settings">
      <NotificationMatrix initial={rules} events={[...NOTIFY_EVENTS]} modules={modules} statuses={statuses} />
    </AppShell>
  );
}
