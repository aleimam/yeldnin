import { requireAdmin } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getSla } from "@/lib/sla/sla-config-service";
import { SlaEditor } from "./SlaEditor";

export default async function SlaSettingsPage() {
  const access = await requireAdmin();
  const [t, sla] = await Promise.all([getT(), getSla()]);

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("sla.title")} backHref="/settings">
      <SlaEditor initial={sla} />
    </AppShell>
  );
}
