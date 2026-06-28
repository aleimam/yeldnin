import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { listEvents, listTemplates } from "@/lib/hr/engagement-service";
import { NewEventForm } from "./NewEventForm";

export default async function EngagementPage() {
  const access = await requireUser();
  if (!access.isAdmin && !access.can("human_resources", "manage")) redirect("/hr");
  const [t, locale, events, templates] = await Promise.all([getT(), getLocale(), listEvents(), listTemplates()]);
  const loc = (x: { name: string; nameAr: string | null } | null | undefined) => (x ? (locale === "ar" && x.nameAr ? x.nameAr : x.name) : null);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("eng.title")} backHref="/hr">
      <div className="max-w-4xl space-y-6">
        <NewEventForm templates={templates.map((tpl) => ({ id: tpl.id, label: loc(tpl) ?? tpl.name }))} defaultMonth={defaultMonth} />

        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm" data-cards>
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="th">{t("eng.event")}</th>
                <th className="th">{t("eng.category")}</th>
                <th className="th">{t("eng.payMonth")}</th>
                <th className="th text-end">{t("eng.eligible")}</th>
                <th className="th text-end">{t("eng.achievements")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-canvas/60">
                  <td className="td" data-label={t("eng.event")}>
                    <Link href={`/hr/engagement/${e.id}`} className="font-medium text-brand hover:underline">{e.title || loc(e.template)}</Link>
                  </td>
                  <td className="td text-muted" data-label={t("eng.category")}>{loc(e.template.category) ?? "—"}</td>
                  <td className="td text-muted" data-datecol data-label={t("eng.payMonth")}>{e.year}-{String(e.month).padStart(2, "0")}</td>
                  <td className="td text-end text-muted" data-label={t("eng.eligible")}>{e._count.eligibles}</td>
                  <td className="td text-end text-muted" data-label={t("eng.achievements")}>{e._count.achievements}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("eng.noEvents")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
