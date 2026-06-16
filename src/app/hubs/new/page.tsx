import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { HubForm } from "../HubForm";

export default async function NewHubPage() {
  const access = await requireModule("logistics", "OPERATE");
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("hubs.new")} backHref="/hubs">
      <HubForm mode="create" initial={{ name: "", country: "USA", notes: "", active: true, photos: [] }} />
    </AppShell>
  );
}
