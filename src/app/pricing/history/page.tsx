import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { listHistory } from "@/lib/pricing/pricing-service";
import { displayName } from "@/lib/users/users-logic";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteCalculationAction } from "../actions";
import { HardDeleteButton, PurgeHistoryButton } from "../HistoryActions";

export default async function HistoryPage() {
  const access = await requireModule("pricing", "VIEW");
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const canManageHistory = access.can("pricing", "deleteAny");
  const rows = await listHistory({ isAdmin: canManageHistory });
  const canSoftDelete = access.can("pricing", "deleteOwn");

  return (
    <AppShell
      access={access}
      moduleKey="pricing"
      pageTitle={t("pricer.history")}
      actions={canManageHistory && rows.length > 0 ? <PurgeHistoryButton /> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
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
                <td className="td whitespace-nowrap text-muted" data-label={t("pricer.hist.date")}>
                  <Link href={`/pricing/history/${r.id}`} className="hover:underline">
                    {new Date(r.createdAt).toLocaleString()}
                  </Link>
                </td>
                <td className="td" data-label={t("pricer.hist.product")}>
                  <Link href={`/pricing/history/${r.id}`} className="font-medium hover:underline">
                    {r.productName || "—"}
                  </Link>
                  {r.deletedAt && (
                    <span className="ms-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
                      {t("pricer.hist.deletedBadge")}
                    </span>
                  )}
                  {r.photos.length > 0 && <span className="ms-2 text-xs text-muted">📎{r.photos.length}</span>}
                </td>
                <td className="td" data-label={t("pricer.hist.section")}>
                  {r.section === "SUPPLEMENT" ? t("pricer.supplements") : t("pricer.devices")}
                </td>
                <td className="td text-muted" data-label={t("pricer.hist.user")}>{displayName(r.user, locale)}</td>
                <td className="td text-end font-medium" data-label={t("pricer.hist.price")}>{r.price.toLocaleString()} EGP</td>
                <td className="td" data-label="">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/pricing/history/${r.id}`} className="text-sm text-brand hover:underline">
                      {t("pricer.details")}
                    </Link>
                    {canManageHistory ? (
                      <HardDeleteButton id={r.id} />
                    ) : (
                      canSoftDelete && !r.deletedAt && <DeleteButton onDelete={deleteCalculationAction.bind(null, r.id)} />
                    )}
                  </div>
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
