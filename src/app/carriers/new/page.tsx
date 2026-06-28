import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { CarrierForm } from "../CarrierForm";

export default async function NewCarrierPage() {
  const access = await requireCapability("logistics", "operate");
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("carriers.new")} backHref="/carriers">
      <CarrierForm mode="create" initial={{ name: "", contact: "", active: true }} />
    </AppShell>
  );
}
