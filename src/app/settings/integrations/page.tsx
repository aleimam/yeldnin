import { requireAdmin } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { veeeyView } from "@/lib/integrations/integrations-service";
import { VeeeyIntegrationForm } from "./VeeeyIntegrationForm";

export default async function IntegrationsSettingsPage() {
  const access = await requireAdmin();
  const [t, veeey] = await Promise.all([getT(), veeeyView()]);
  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("integ.title")} backHref="/settings">
      <div className="max-w-2xl">
        <VeeeyIntegrationForm initial={veeey} />
      </div>
    </AppShell>
  );
}
