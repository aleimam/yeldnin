import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCategories } from "@/lib/expenses/expenses-service";
import { saveCategoriesAction, deleteCategoryAction } from "../actions";
import { DeleteButton } from "@/components/DeleteButton";

export default async function CategoriesSettingsPage() {
  const access = await requireCapability("expenses", "manageReference");
  const [t, categories] = await Promise.all([getT(), listCategories(true)]);

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("exp.categories")} backHref="/settings">
      <form action={saveCategoriesAction} className="card max-w-3xl space-y-2 p-6">
        <input type="hidden" name="ids" value={categories.map((c) => c.id).join(",")} />

        <div className="hidden grid-cols-[1fr_140px_80px_80px] gap-3 px-1 text-xs font-semibold text-muted sm:grid">
          <span>{t("exp.name")}</span>
          <span>{t("exp.type")}</span>
          <span>{t("exp.enabled")}</span>
          <span>{t("common.delete")}</span>
        </div>

        {categories.map((c) => (
          <div key={c.id} className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_140px_80px_80px]">
            <input name={`name_${c.id}`} defaultValue={c.name} className="input" />
            <select name={`type_${c.id}`} defaultValue={c.type} className="input">
              <option value="EXPENSE">{t("exp.expense")}</option>
              <option value="TRANSFER">{t("exp.transfer")}</option>
            </select>
            <label className="flex justify-center"><input type="checkbox" name={`enabled_${c.id}`} defaultChecked={c.enabled} /></label>
            <div className="flex justify-center"><DeleteButton onDelete={deleteCategoryAction.bind(null, c.id)} /></div>
          </div>
        ))}

        {/* New row */}
        <div className="grid grid-cols-2 items-center gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_140px_80px_80px]">
          <input name="new_name" placeholder={`+ ${t("exp.name")}`} className="input" />
          <select name="new_type" className="input">
            <option value="EXPENSE">{t("exp.expense")}</option>
            <option value="TRANSFER">{t("exp.transfer")}</option>
          </select>
        </div>

        <div className="pt-3">
          <button type="submit" className="btn-primary">{t("common.saveAll")}</button>
        </div>
      </form>
    </AppShell>
  );
}
