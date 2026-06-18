import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listRepBonuses, getBonusTiers } from "@/lib/cs/cs-bonus-service";
import { MaxBonusEditor } from "./MaxBonusEditor";
import { BonusTiersEditor } from "./BonusTiersEditor";

export default async function CsBonusPage() {
  const access = await requireModule("cs_quality", "MANAGE");
  const [t, reps, tiers] = await Promise.all([getT(), listRepBonuses(), getBonusTiers()]);
  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("cs.bonus")} backHref="/cs-quality">
      <div className="max-w-2xl space-y-6">
        <BonusTiersEditor initial={tiers} />
        <MaxBonusEditor initial={reps} />
      </div>
    </AppShell>
  );
}
