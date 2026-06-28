import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { formatEgp } from "@/lib/format/money";
import { getEmployeeByUserId } from "@/lib/hr/hr-service";
import { employeeEngagement } from "@/lib/hr/engagement-service";
import { bonusTotal } from "@/lib/hr/engagement-logic";

export default async function MyEngagementPage() {
  const access = await requireUser();
  const [t, locale, emp] = await Promise.all([getT(), getLocale(), getEmployeeByUserId(access.user.id)]);
  const rows = emp ? await employeeEngagement(emp.id) : [];
  const grand = bonusTotal(rows.flatMap((r) => r.achieved));

  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("eng.myTitle")} backHref="/hr">
      <div className="max-w-3xl space-y-4">
        <div className="card p-5">
          <div className="text-xs text-muted">{t("eng.totalEarned")}</div>
          <div className="mt-1 text-2xl font-bold text-ink">{formatEgp(grand)}</div>
        </div>

        {rows.length === 0 ? (
          <div className="card p-6 text-sm text-muted">{t("eng.myEmpty")}</div>
        ) : (
          rows.map((r) => (
            <div key={r.eventId} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-ink">{r.title || (locale === "ar" && r.templateNameAr ? r.templateNameAr : r.templateName)}</h2>
                <span className="text-sm text-muted">{r.year}-{String(r.month).padStart(2, "0")}</span>
              </div>
              {r.achieved.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{t("eng.nothingAchieved")}</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {r.achieved.map((c, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="text-ink">✓ {locale === "ar" && c.nameAr ? c.nameAr : c.name}</span>
                      <span className="text-muted">{formatEgp(c.bonusAmount)}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between border-t border-line/60 pt-1 font-medium">
                    <span className="text-ink">{t("eng.bonus")}</span>
                    <span className="text-ink">{formatEgp(r.bonus)}</span>
                  </li>
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
