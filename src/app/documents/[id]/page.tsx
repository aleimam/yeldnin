import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { assetUrl } from "@/lib/assets/assets-service";
import { canEditContent, canManageDocument, isReviewDue } from "@/lib/documents/documents-logic";
import { getDocumentForUser, getMyAck, listDocumentVersions, ackAudience } from "@/lib/documents/documents-service";
import { listTeams } from "@/lib/users/users-service";
import { RichTextView } from "@/components/documents/RichTextView";
import { DocStatusBadge } from "../DocStatusBadge";
import { StatusToggle } from "../StatusToggle";
import { DeleteDocumentButton } from "../DeleteDocumentButton";
import { PermissionsEditor } from "../PermissionsEditor";
import { AckButton } from "../AckButton";
import { RestoreVersionButton } from "../RestoreVersionButton";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const v = { isAdmin: access.isAdmin, userId: access.user.id, userTeamKeys: access.user.teamKeys };
  const { id } = await params;
  const result = await getDocumentForUser(Number(id), v);
  if (!result) notFound();
  const { doc, level } = result;

  const canEdit = canEditContent(level);
  const canManage = canManageDocument(level);
  const published = doc.status === "PUBLISHED";
  const due = isReviewDue(doc.reviewBy);
  const [t, teams, myAck, versions, audience] = await Promise.all([
    getT(),
    canManage ? listTeams() : Promise.resolve([]),
    published ? getMyAck(doc.id, v.userId) : Promise.resolve(null),
    canManage ? listDocumentVersions(doc.id) : Promise.resolve([]),
    canManage ? ackAudience(doc.id) : Promise.resolve([]),
  ]);
  const ackedCount = audience.filter((a) => a.acknowledgedAt).length;
  const pdfUrl = doc.kind === "PDF" ? assetUrl(doc.assetId) : null;

  const actions = (
    <div className="flex items-center gap-2">
      {doc.kind === "DOC" && (
        <a href={`/api/documents/${doc.id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">{t("docs.pdf.download")}</a>
      )}
      {canEdit && <Link href={`/documents/${doc.id}/edit`} className="btn-primary btn-sm">{t("docs.edit")}</Link>}
    </div>
  );

  return (
    <AppShell access={access} moduleKey="documents" pageTitle={doc.title} backHref="/documents" actions={actions}>
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <DocStatusBadge status={doc.status} label={t(`docs.status.${doc.status}`)} />
            <span className="text-xs text-muted">{t(`docs.kind.${doc.kind}`)}</span>
            {due && <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">{t("docs.reviewDue")}</span>}
          </div>
          {doc.description && <p className="mb-3 whitespace-pre-wrap text-sm text-ink">{doc.description}</p>}
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div><span className="text-muted">{t("docs.category")}: </span><span className="text-ink">{doc.category?.name ?? "—"}</span></div>
            <div><span className="text-muted">{t("docs.created")}: </span><span className="text-ink">{formatBizDate(doc.creationDate ?? doc.createdAt)}</span></div>
            <div><span className="text-muted">{t("docs.updated")}: </span><span className="text-ink">{formatBizDate(doc.updatedAt)}</span></div>
            {doc.reviewBy && <div><span className="text-muted">{t("docs.reviewBy")}: </span><span className="text-ink">{formatBizDate(doc.reviewBy)}</span></div>}
          </div>
          {doc.status === "DRAFT" && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-600">{t("docs.draftNotice")}</p>
          )}
          {canManage && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
              <StatusToggle id={doc.id} status={doc.status} />
              <DeleteDocumentButton id={doc.id} />
            </div>
          )}
        </div>

        <div className="card p-5">
          {doc.kind === "DOC" ? (
            <RichTextView html={doc.contentHtml ?? ""} />
          ) : pdfUrl ? (
            <div className="space-y-3">
              <iframe src={pdfUrl} className="h-[70vh] w-full rounded-lg border border-line" title={doc.title} />
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm inline-block">{t("docs.download")}</a>
            </div>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </div>

        {/* Read acknowledgement — published docs, any viewer */}
        {published && (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="text-sm">
              {myAck ? (
                <span className="text-green-600">✓ {t("docs.ack.done", { date: formatBizDate(myAck.acknowledgedAt) })}</span>
              ) : (
                <span className="text-muted">{t("docs.ack.prompt")}</span>
              )}
            </div>
            {!myAck && <AckButton id={doc.id} />}
          </div>
        )}

        {/* Who has / hasn't read (Manage) */}
        {canManage && audience.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-ink">
              {t("docs.ack.section")} <span className="text-sm font-normal text-muted">· {t("docs.ack.summary", { done: ackedCount, total: audience.length })}</span>
            </h2>
            <table className="w-full text-sm" data-cards>
              <thead className="border-b border-line"><tr><th className="th">{t("docs.ack.who")}</th><th className="th">{t("docs.ack.status")}</th><th className="th">{t("docs.ack.when")}</th></tr></thead>
              <tbody className="divide-y divide-line">
                {audience.map((a) => (
                  <tr key={a.userId}>
                    <td className="td" data-label={t("docs.ack.who")}>{a.name}</td>
                    <td className="td" data-label={t("docs.ack.status")}>{a.acknowledgedAt ? <span className="text-green-600">{t("docs.ack.acknowledged")}</span> : <span className="text-muted">{t("docs.ack.pending")}</span>}</td>
                    <td className="td text-muted" data-datecol data-label={t("docs.ack.when")}>{a.acknowledgedAt ? formatBizDate(a.acknowledgedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Version history (Manage) */}
        {canManage && versions.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-ink">{t("docs.ver.section")}</h2>
            <table className="w-full text-sm" data-cards>
              <thead className="border-b border-line"><tr><th className="th">{t("docs.ver.no")}</th><th className="th">{t("docs.ver.editedBy")}</th><th className="th">{t("docs.ver.when")}</th><th className="th"></th></tr></thead>
              <tbody className="divide-y divide-line">
                {versions.map((vr, i) => (
                  <tr key={vr.id}>
                    <td className="td" data-label={t("docs.ver.no")}>v{vr.versionNo}{i === 0 && <span className="ms-2 text-xs text-green-600">{t("docs.ver.current")}</span>}</td>
                    <td className="td text-muted" data-label={t("docs.ver.editedBy")}>{vr.editedBy ?? "—"}</td>
                    <td className="td text-muted" data-datecol data-label={t("docs.ver.when")}>{formatBizDate(vr.createdAt)}</td>
                    <td className="td text-end">{i !== 0 && <RestoreVersionButton id={doc.id} versionId={vr.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage && (
          <PermissionsEditor documentId={doc.id} teams={teams.map((tm) => ({ key: tm.key, name: tm.name }))} current={doc.permissions} />
        )}
      </div>
    </AppShell>
  );
}
