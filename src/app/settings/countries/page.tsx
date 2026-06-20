import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listCountries } from "@/lib/countries/countries-service";
import { saveCountriesAction, deleteCountryAction } from "./actions";
import { DeleteButton } from "@/components/DeleteButton";
import { ActionForm } from "@/components/ActionForm";

export default async function CountriesSettingsPage() {
  const access = await requireCapability("settings", "manageModules");
  const [t, countries] = await Promise.all([getT(), listCountries(true)]);

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("countries.title")} backHref="/settings">
      <ActionForm action={saveCountriesAction} className="card max-w-2xl space-y-2 p-6">
        <input type="hidden" name="ids" value={countries.map((c) => c.id).join(",")} />

        <div className="hidden grid-cols-[1fr_80px_80px] gap-3 px-1 text-xs font-semibold text-muted sm:grid">
          <span>{t("countries.name")}</span>
          <span>{t("exp.enabled")}</span>
          <span>{t("common.delete")}</span>
        </div>

        {countries.map((c) => (
          <div key={c.id} className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_80px_80px]">
            <input name={`name_${c.id}`} defaultValue={c.name} className="input" />
            <label className="flex justify-center"><input type="checkbox" name={`enabled_${c.id}`} defaultChecked={c.enabled} /></label>
            <div className="flex justify-center"><DeleteButton onDelete={deleteCountryAction.bind(null, c.id)} /></div>
          </div>
        ))}

        <div className="grid grid-cols-2 items-center gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_80px_80px]">
          <input name="new_name" placeholder={`+ ${t("countries.name")}`} className="input" />
        </div>
      </ActionForm>
    </AppShell>
  );
}
