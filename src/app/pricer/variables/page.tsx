import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getPricingConfig } from "@/lib/pricing/pricing-config-service";
import { VariablesForm } from "./VariablesForm";

export default async function VariablesPage() {
  const access = await requireModule("egv_pricer", "MANAGE");
  const [t, config] = await Promise.all([getT(), getPricingConfig()]);
  return (
    <AppShell access={access} moduleKey="egv_pricer" pageTitle={t("pricer.var.title")}>
      <VariablesForm config={config} />
    </AppShell>
  );
}
