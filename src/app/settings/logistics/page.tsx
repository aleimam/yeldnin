import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listSuppliers } from "@/lib/suppliers/suppliers-service";
import {
  createSupplierAction,
  updateSupplierAction,
  archiveSupplierAction,
} from "./actions";

export default async function LogisticsSettingsPage() {
  const access = await requireModule("settings", "MANAGE");
  const [t, suppliers] = await Promise.all([getT(), listSuppliers()]);

  return (
    <AppShell user={access.user} title={t("suppliers.title")} backHref="/settings">
      {/* New supplier */}
      <form action={createSupplierAction} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[180px]">
          <label className="label">{t("suppliers.name")}</label>
          <input name="name" className="input" required />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">{t("suppliers.contact")}</label>
          <input name="contact" className="input" />
        </div>
        <div>
          <label className="label">{t("suppliers.countries")}</label>
          <div className="flex gap-3 py-2 text-sm">
            <label className="flex items-center gap-1"><input type="checkbox" name="availableUSA" /> USA</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="availableUK" /> UK</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="availableEU" /> EU</label>
          </div>
        </div>
        <button type="submit" className="btn-primary">{t("suppliers.new")}</button>
      </form>

      {/* Existing suppliers — each row is its own save form */}
      <div className="space-y-3">
        {suppliers.map((s) => (
          <div key={s.id} className="card flex flex-wrap items-end gap-3 p-4">
            <form action={updateSupplierAction} className="flex flex-1 flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={s.id} />
              <div className="flex-1 min-w-[160px]">
                <label className="label">{t("suppliers.name")}</label>
                <input name="name" className="input" defaultValue={s.name} />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="label">{t("suppliers.contact")}</label>
                <input name="contact" className="input" defaultValue={s.contact ?? ""} />
              </div>
              <div>
                <label className="label">{t("suppliers.countries")}</label>
                <div className="flex gap-3 py-2 text-sm">
                  <label className="flex items-center gap-1"><input type="checkbox" name="availableUSA" defaultChecked={s.availableUSA} /> USA</label>
                  <label className="flex items-center gap-1"><input type="checkbox" name="availableUK" defaultChecked={s.availableUK} /> UK</label>
                  <label className="flex items-center gap-1"><input type="checkbox" name="availableEU" defaultChecked={s.availableEU} /> EU</label>
                </div>
              </div>
              <label className="flex items-center gap-1 py-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={s.active} /> {t("suppliers.active")}
              </label>
              <button type="submit" className="btn-secondary">{t("common.save")}</button>
            </form>
            <form action={archiveSupplierAction}>
              <input type="hidden" name="id" value={s.id} />
              <button type="submit" className="btn-danger">{t("common.delete")}</button>
            </form>
          </div>
        ))}
        {suppliers.length === 0 && <p className="text-muted">—</p>}
      </div>
    </AppShell>
  );
}
