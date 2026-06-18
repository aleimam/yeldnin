import { requireAdmin } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getCsConfig } from "@/lib/cs/cs-config-service";
import { ValuesEditor } from "./ValuesEditor";

export default async function CsValuesPage() {
  const access = await requireAdmin();
  const [t, config] = await Promise.all([getT(), getCsConfig()]);
  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.answerValues")} backHref="/cs-quality">
      <ValuesEditor initial={config} />
    </AppShell>
  );
}
