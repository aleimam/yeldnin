import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listHistory } from "@/lib/pricing/pricing-service";
import { DeleteButton } from "../DeleteButton";

export default async function HistoryPage() {
  const access = await requireModule("egv_pricer", "VIEW");
  const t = await getT();
  const isAdmin = access.canModule("egv_pricer", "MANAGE") || access.isAdmin;
  const rows = await listHistory({ isAdmin });
  const canDelete = access.canModule("egv_pricer", "OPERATE");

  return (
    <AppShell access={access} moduleKey="egv_pricer" pageTitle={t("pricer.history")}>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("pricer.hist.date")}</th>
              <th className="th">{t("pricer.hist.product")}</th>
              <th className="th">{t("pricer.hist.section")}</th>
              <th className="th">{t("pricer.hist.user")}</th>
              <th className="th text-end">{t("pricer.hist.price")}</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className={r.deletedAt ? "opacity-50" : "hover:bg-canvas/60"}>
                <td className="td whitespace-nowrap text-muted">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="td">
                  {r.productName || "—"}
                  {r.deletedAt && (
                    <span className="ms-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
                      {t("pricer.hist.deletedBadge")}
                    </span>
                  )}
                  {r.photos.length > 0 && <span className="ms-2 text-xs text-muted">📎{r.photos.length}</span>}
                </td>
                <td className="td">
                  {r.section === "SUPPLEMENT" ? t("pricer.supplements") : t("pricer.devices")}
                </td>
                <td className="td text-muted">{r.user.name}</td>
                <td className="td text-end font-medium">{r.price.toLocaleString()} EGP</td>
                <td className="td text-end">
                  {canDelete && !r.deletedAt && <DeleteButton id={r.id} />}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="td text-muted" colSpan={6}>{t("pricer.empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
