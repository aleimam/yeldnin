import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCategories } from "@/lib/expenses/expenses-service";
import { createCategoryAction, updateCategoryAction } from "../actions";

export default async function CategoriesPage() {
  const access = await requireModule("expenses", "MANAGE");
  const [t, categories] = await Promise.all([getT(), listCategories(true)]);

  return (
    <AppShell access={access} moduleKey="expenses" pageTitle={t("exp.categories")}>
      <form action={createCategoryAction} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[180px]"><label className="label">{t("exp.name")}</label><input name="name" className="input" required /></div>
        <div>
          <label className="label">{t("exp.type")}</label>
          <select name="type" className="input">
            <option value="EXPENSE">{t("exp.expense")}</option>
            <option value="TRANSFER">{t("exp.transfer")}</option>
          </select>
        </div>
        <button className="btn-primary">{t("exp.add")}</button>
      </form>

      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-end gap-3 p-3">
            <form action={updateCategoryAction} className="flex flex-1 flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={c.id} />
              <div className="flex-1 min-w-[160px]"><label className="label">{t("exp.name")}</label><input name="name" defaultValue={c.name} className="input" /></div>
              <div>
                <label className="label">{t("exp.type")}</label>
                <select name="type" defaultValue={c.type} className="input">
                  <option value="EXPENSE">{t("exp.expense")}</option>
                  <option value="TRANSFER">{t("exp.transfer")}</option>
                </select>
              </div>
              <label className="flex items-center gap-1 py-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={c.enabled} /> {t("exp.enabled")}</label>
              <button className="btn-secondary">{t("exp.save")}</button>
            </form>
            <form action={updateCategoryAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="delete" value="1" />
              <button className="btn-danger">{t("common.delete")}</button>
            </form>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
