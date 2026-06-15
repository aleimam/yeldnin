import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getPricingConfig } from "@/lib/pricing/pricing-config-service";
import { PricerNav } from "../PricerNav";
import { VariablesForm } from "./VariablesForm";

export default async function VariablesPage() {
  const access = await requireModule("egv_pricer", "MANAGE");
  const [t, config] = await Promise.all([getT(), getPricingConfig()]);
  return (
    <AppShell user={access.user} title={t("pricer.var.title")} backHref="/">
      <PricerNav canManage />
      <VariablesForm config={config} />
    </AppShell>
  );
}
