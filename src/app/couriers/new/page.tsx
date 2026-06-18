import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { CourierForm } from "../CourierForm";

export default async function NewCourierPage() {
  const access = await requireCapability("couriers", "operate");
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="couriers" pageTitle={t("couriers.new")} backHref="/couriers">
      <CourierForm mode="create" initial={{ name: "", contact: "", active: true }} />
    </AppShell>
  );
}
