import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { formatBizDate } from "@/lib/format/dates";
import { canManageCs, localized } from "@/lib/cs/cs-logic";
import { getEvaluationDetail } from "@/lib/cs/cs-report-service";
import { ReviewActions } from "./ReviewActions";
import { DeleteEvalButton } from "./DeleteEvalButton";

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};
const lvlTone = (l: string) => (l === "CATASTROPHE" ? "text-red-600" : l === "OUTSTANDING" ? "text-green-600" : "text-ink");

export default async function CsEvaluationDetail({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const { id } = await params;
  const data = await getEvaluationDetail(Number(id));
  if (!data) notFound();
  const { ev, subject, evaluator, approver } = data;
  const me = access.user.id;
  const admin = canManageCs(access);
  const isEvaluator = ev.evaluatorUserId === me;
  const isSubject = ev.subjectUserId === me;
  // Subject sees only their own approved; evaluator sees their own; admins all.
  if (!(admin || isEvaluator || (isSubject && ev.status === "APPROVED"))) redirect("/cs-quality");
  const showEvaluator = admin || isEvaluator; // the rep never sees who evaluated them
  const staffView = admin || isEvaluator; // reps don't see weight/weighted/value mechanics
  const canDelete = admin || (isEvaluator && ev.status === "PENDING");
  const backHref = admin ? "/cs-quality/review" : isSubject ? "/cs-quality/mine" : "/cs-quality/submitted";
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  // Eval-level type chip: borrow the Arabic type name snapshotted on any answer.
  const evTypeName = ev.typeName ? localized(ev.typeName, ev.answers.find((a) => a.typeNameAr)?.typeNameAr, locale) : null;

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={ev.uid ?? `#${ev.id}`} backHref={backHref}>
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <div><span className="text-muted">{t("cs.salesRep")}: </span><span className="text-ink">{subject}</span></div>
              <div><span className="text-muted">{t("cs.scope")}: </span><span className="text-ink">{t(`cs.scope.${ev.scope}`)}{evTypeName ? ` · ${evTypeName}` : ""}</span></div>
              {showEvaluator && <div><span className="text-muted">{t("cs.evaluator")}: </span><span className="text-ink">{evaluator}</span></div>}
              <div><span className="text-muted">{t("cs.date")}: </span><span className="text-ink">{formatBizDate(ev.scope === "CALL" ? ev.callDate ?? ev.createdAt : ev.createdAt)}</span></div>
              {ev.channel && <div><span className="text-muted">{t("cs.channel")}: </span><span className="text-ink">{t(`cs.channel.${ev.channel}`)}</span></div>}
              {ev.contact && <div><span className="text-muted">{t("cs.contact")}: </span><span className="text-ink">{ev.contact}</span></div>}
              <div><span className="text-muted">{t("cs.score")}: </span><span className="font-semibold text-ink">{ev.total}</span></div>
              <div><span className="text-muted">{t("cs.normalized")}: </span><span className="font-semibold text-ink">{ev.normalized}%</span></div>
              {ev.status === "APPROVED" && approver && (
                <div><span className="text-muted">{t("cs.approvedBy")}: </span><span className="text-ink">{approver}{ev.approvedAt ? ` · ${formatBizDate(ev.approvedAt)}` : ""}</span></div>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[ev.status] ?? "bg-canvas text-muted"}`}>{t(`cs.status.${ev.status}`)}</span>
          </div>
          {ev.status === "REJECTED" && ev.rejectedNote && <p className="mt-3 text-sm text-red-600">{t("cs.rejectReason")}: {ev.rejectedNote}</p>}
          {(canDelete || (admin && ev.status === "PENDING")) && (
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3">
              {admin && ev.status === "PENDING" && <ReviewActions id={ev.id} />}
              {canDelete && <DeleteEvalButton id={ev.id} backHref={backHref} />}
            </div>
          )}
        </div>

        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm" data-cards>
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="th">{t("cs.criteria")}</th>
                <th className="th">{staffView ? t("cs.answer") : t("cs.score")}</th>
                {staffView && <th className="th text-end">{t("cs.weight")}</th>}
                {staffView && <th className="th text-end">{t("cs.weighted")}</th>}
                <th className="th">{t("cs.note")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ev.answers.map((a) => (
                <tr key={a.id}>
                  <td className="td" data-label={t("cs.criteria")}>
                    <span className="font-medium text-ink">{localized(a.title, a.titleAr, locale) || localized(a.criteria, a.criteriaAr, locale)}</span>
                    {staffView && a.title && a.criteria && <span className="block text-xs text-muted">{localized(a.criteria, a.criteriaAr, locale)}</span>}
                    {staffView && a.typeName && <span className="block text-[10px] uppercase text-muted">{localized(a.typeName, a.typeNameAr, locale)}</span>}
                  </td>
                  <td className="td" data-label={staffView ? t("cs.answer") : t("cs.score")}><span className={`font-medium ${lvlTone(a.level)}`}>{t(`cs.level.${a.level}`)}</span>{staffView && <span className="text-xs text-muted"> ({a.value})</span>}</td>
                  {staffView && <td className="td text-end" data-label={t("cs.weight")}>{a.weight}</td>}
                  {staffView && <td className="td text-end" data-label={t("cs.weighted")}>{a.weighted}</td>}
                  <td className="td text-muted" data-label={t("cs.note")}>{a.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ev.photos.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-ink">{t("cs.photos")}</h2>
            <div className="flex flex-wrap gap-2">
              {ev.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={p.id} href={assetUrl(p.assetId)!} target="_blank" rel="noreferrer"><img src={assetUrl(p.assetId)!} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" /></a>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
