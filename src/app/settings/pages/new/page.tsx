import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { PageEditor } from "../PageEditor";
import { createPageAction } from "../actions";

export default async function NewPagePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await requireCapability("settings", "managePages");
  const [t, sp] = await Promise.all([getT(), searchParams]);
  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("pages.new")} backHref="/settings/pages">
      <PageEditor page={null} action={createPageAction} error={sp.error} />
    </AppShell>
  );
}
