import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listAccounts } from "@/lib/expenses/expenses-service";
import { saveBankCollectionAction } from "../actions";
import { ActionForm } from "@/components/ActionForm";
import { AutoTextarea } from "@/components/AutoTextarea";

export default async function BankCollectionsPage() {
  const access = await requireCapability("expenses", "manageAdmin");
  const [t, accounts] = await Promise.all([getT(), listAccounts()]);
  const now = new Date();

  return (
    <AppShell access={access} moduleKey="expenses" pageTitle={t("exp.bankCollections")}>
      <ActionForm action={saveBankCollectionAction} className="card max-w-xl space-y-4 p-6" saveLabel={t("exp.save")}>
        <div className="flex gap-3">
          <div><label className="label">{t("exp.year")}</label><input name="year" type="number" defaultValue={now.getFullYear()} className="input w-28" /></div>
          <div><label className="label">{t("exp.month")}</label><input name="month" type="number" min="1" max="12" defaultValue={now.getMonth() + 1} className="input w-24" /></div>
        </div>
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink">{a.name}</span>
              <input name={`amt_${a.id}`} type="number" step="any" defaultValue="0" className="input w-40 text-end" />
            </div>
          ))}
        </div>
        <div><label className="label">{t("exp.note")}</label><AutoTextarea name="note" /></div>
      </ActionForm>
    </AppShell>
  );
}
