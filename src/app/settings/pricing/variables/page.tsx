import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getPricingConfig } from "@/lib/pricing/pricing-config-service";
import { VariablesForm } from "./VariablesForm";

export default async function VariablesPage() {
  const access = await requireCapability("pricing", "editVariables");
  const [t, config] = await Promise.all([getT(), getPricingConfig()]);
  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("pricer.var.title")} backHref="/settings">
      <VariablesForm config={config} />
    </AppShell>
  );
}
