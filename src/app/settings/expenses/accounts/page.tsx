import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listAccounts } from "@/lib/expenses/expenses-service";
import { saveAccountsAction } from "../actions";

export default async function AccountsSettingsPage() {
  const access = await requireCapability("expenses", "manageReference");
  const [t, accounts] = await Promise.all([getT(), listAccounts(true)]);

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("exp.accounts")} backHref="/settings">
      <form action={saveAccountsAction} className="card max-w-2xl space-y-2 p-6">
        <input type="hidden" name="ids" value={accounts.map((a) => a.id).join(",")} />

        <div className="hidden grid-cols-[1fr_80px_80px] gap-3 px-1 text-xs font-semibold text-muted sm:grid">
          <span>{t("exp.name")}</span>
          <span>{t("exp.enabled")}</span>
          <span>{t("common.delete")}</span>
        </div>

        {accounts.map((a) => (
          <div key={a.id} className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_80px_80px]">
            <input name={`name_${a.id}`} defaultValue={a.name} className="input" />
            <label className="flex justify-center"><input type="checkbox" name={`enabled_${a.id}`} defaultChecked={a.enabled} /></label>
            <label className="flex justify-center"><input type="checkbox" name={`remove_${a.id}`} /></label>
          </div>
        ))}

        <div className="grid grid-cols-2 items-center gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_80px_80px]">
          <input name="new_name" placeholder={`+ ${t("exp.name")}`} className="input" />
        </div>

        <div className="pt-3">
          <button type="submit" className="btn-primary">{t("common.saveAll")}</button>
        </div>
      </form>
    </AppShell>
  );
}
