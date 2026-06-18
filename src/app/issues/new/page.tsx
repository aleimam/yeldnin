import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { IssueForm } from "../IssueForm";

export default async function NewIssuePage() {
  const access = await requireCapability("issues", "operate");
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="issues" pageTitle={t("issues.new")} backHref="/issues">
      <IssueForm />
    </AppShell>
  );
}
