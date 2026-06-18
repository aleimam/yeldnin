import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";

export default async function HrPage() {
  const access = await requireModule("human_resources", "VIEW");
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("module.human_resources.name")}>
      <div className="card max-w-xl p-8 text-center text-sm text-muted">{t("hr.soon")}</div>
    </AppShell>
  );
}
