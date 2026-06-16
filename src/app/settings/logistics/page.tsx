import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listSuppliers } from "@/lib/suppliers/suppliers-service";
import { saveSuppliersAction } from "./actions";

export default async function LogisticsSettingsPage() {
  const access = await requireModule("settings", "MANAGE");
  const [t, suppliers] = await Promise.all([getT(), listSuppliers()]);

  const cols = "sm:grid-cols-[1fr_1fr_150px_70px_70px]";

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("suppliers.title")} backHref="/settings">
      <form action={saveSuppliersAction} className="card space-y-3 p-6">
        <input type="hidden" name="ids" value={suppliers.map((s) => s.id).join(",")} />

        <div className={`hidden gap-3 px-1 text-xs font-semibold text-muted sm:grid ${cols}`}>
          <span>{t("suppliers.name")}</span>
          <span>{t("suppliers.contact")}</span>
          <span>{t("suppliers.countries")}</span>
          <span>{t("suppliers.active")}</span>
          <span>{t("common.delete")}</span>
        </div>

        {suppliers.map((s) => (
          <div key={s.id} className={`grid grid-cols-1 items-center gap-3 ${cols}`}>
            <input name={`name_${s.id}`} defaultValue={s.name} className="input" />
            <input name={`contact_${s.id}`} defaultValue={s.contact ?? ""} className="input" />
            <div className="flex gap-2 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" name={`usa_${s.id}`} defaultChecked={s.availableUSA} /> USA</label>
              <label className="flex items-center gap-1"><input type="checkbox" name={`uk_${s.id}`} defaultChecked={s.availableUK} /> UK</label>
              <label className="flex items-center gap-1"><input type="checkbox" name={`eu_${s.id}`} defaultChecked={s.availableEU} /> EU</label>
            </div>
            <label className="flex sm:justify-center"><input type="checkbox" name={`active_${s.id}`} defaultChecked={s.active} /></label>
            <label className="flex sm:justify-center"><input type="checkbox" name={`remove_${s.id}`} /></label>
          </div>
        ))}

        {/* New row */}
        <div className={`grid grid-cols-1 items-center gap-3 border-t border-line pt-3 ${cols}`}>
          <input name="new_name" placeholder={`+ ${t("suppliers.name")}`} className="input" />
          <input name="new_contact" placeholder={t("suppliers.contact")} className="input" />
          <div className="flex gap-2 text-xs">
            <label className="flex items-center gap-1"><input type="checkbox" name="new_usa" /> USA</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="new_uk" /> UK</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="new_eu" /> EU</label>
          </div>
        </div>

        <div className="pt-3">
          <button type="submit" className="btn-primary">{t("common.saveAll")}</button>
        </div>
      </form>
    </AppShell>
  );
}
