import { requireAdmin } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCsTypes } from "@/lib/cs/cs-types-service";
import { TypesEditor } from "./TypesEditor";

export default async function CsTypesPage() {
  const access = await requireAdmin();
  const [t, call, periodical] = await Promise.all([getT(), listCsTypes("CALL"), listCsTypes("PERIODICAL")]);
  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.types")} backHref="/cs-quality">
      <div className="max-w-2xl space-y-6">
        <TypesEditor scope="CALL" title={t("cs.scope.CALL")} initial={call.map((c) => ({ id: c.id, name: c.name }))} />
        <TypesEditor scope="PERIODICAL" title={t("cs.scope.PERIODICAL")} initial={periodical.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </AppShell>
  );
}
