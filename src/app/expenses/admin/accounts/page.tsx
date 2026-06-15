import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listAccounts } from "@/lib/expenses/expenses-service";
import { createAccountAction, updateAccountAction } from "../actions";

export default async function AccountsPage() {
  const access = await requireModule("expenses", "MANAGE");
  const [t, accounts] = await Promise.all([getT(), listAccounts(true)]);

  return (
    <AppShell access={access} moduleKey="expenses" pageTitle={t("exp.accounts")}>
      <form action={createAccountAction} className="card mb-6 flex items-end gap-3 p-4">
        <div className="flex-1"><label className="label">{t("exp.name")}</label><input name="name" className="input" required /></div>
        <button className="btn-primary">{t("exp.add")}</button>
      </form>

      <div className="space-y-2">
        {accounts.map((a) => (
          <div key={a.id} className="card flex flex-wrap items-end gap-3 p-3">
            <form action={updateAccountAction} className="flex flex-1 flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={a.id} />
              <div className="flex-1 min-w-[160px]"><label className="label">{t("exp.name")}</label><input name="name" defaultValue={a.name} className="input" /></div>
              <label className="flex items-center gap-1 py-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={a.enabled} /> {t("exp.enabled")}</label>
              <button className="btn-secondary">{t("exp.save")}</button>
            </form>
            <form action={updateAccountAction}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="delete" value="1" />
              <button className="btn-danger">{t("common.delete")}</button>
            </form>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
