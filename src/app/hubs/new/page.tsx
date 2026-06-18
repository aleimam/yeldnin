import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCountryOptions } from "@/lib/countries/countries-service";
import { HubForm } from "../HubForm";

export default async function NewHubPage() {
  const access = await requireCapability("logistics", "operate");
  const [t, countries] = await Promise.all([getT(), listCountryOptions()]);
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("hubs.new")} backHref="/hubs">
      <HubForm mode="create" countries={countries} initial={{ name: "", country: "", notes: "", active: true, photos: [] }} />
    </AppShell>
  );
}
