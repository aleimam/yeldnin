import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";
import { getEvent, activeEmployeeOptions } from "@/lib/hr/engagement-service";
import { EngagementGrid } from "./EngagementGrid";
import { ArchiveEventButton } from "./ArchiveEventButton";

export default async function EngagementEventPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  if (!access.isAdmin && !access.can("human_resources", "manage")) redirect("/hr");
  const { id } = await params;
  const [t, locale, event, allEmployees] = await Promise.all([getT(), getLocale(), getEvent(Number(id)), activeEmployeeOptions()]);
  if (!event) notFound();

  const loc = (x: { name: string; nameAr: string | null } | null | undefined) => (x ? (locale === "ar" && x.nameAr ? x.nameAr : x.name) : null);
  const eligible = event.eligibles
    .map((e) => ({ id: e.employee.id, label: e.employee.user ? displayName(e.employee.user, locale) : `#${e.employee.id}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const eligibleIds = eligible.map((e) => e.id);
  const achievedKeys = event.achievements.map((a) => `${a.criterionId}:${a.employeeId}`);
  const criteria = event.template.criteria.map((c) => ({ id: c.id, name: locale === "ar" && c.nameAr ? c.nameAr : c.name, bonusAmount: c.bonusAmount }));
  const title = event.title || loc(event.template) || t("eng.event");

  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={title} backHref="/hr/engagement" actions={<ArchiveEventButton id={event.id} />}>
      <div className="max-w-4xl space-y-6">
        <div className="card p-5 text-sm">
          <div className="flex flex-wrap gap-x-8 gap-y-1">
            <div><span className="text-muted">{t("eng.template")}: </span><span className="text-ink">{loc(event.template)}</span></div>
            <div><span className="text-muted">{t("eng.payMonth")}: </span><span className="text-ink">{event.year}-{String(event.month).padStart(2, "0")}</span></div>
          </div>
          {event.notes && <p className="mt-2 whitespace-pre-wrap text-ink">{event.notes}</p>}
        </div>
        <EngagementGrid eventId={event.id} allEmployees={allEmployees} eligible={eligible} eligibleIds={eligibleIds} criteria={criteria} achievedKeys={achievedKeys} />
      </div>
    </AppShell>
  );
}
