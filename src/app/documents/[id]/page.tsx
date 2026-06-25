import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { assetUrl } from "@/lib/assets/assets-service";
import { canEditContent, canManageDocument } from "@/lib/documents/documents-logic";
import { getDocumentForUser } from "@/lib/documents/documents-service";
import { listTeams } from "@/lib/users/users-service";
import { RichTextView } from "@/components/documents/RichTextView";
import { DocStatusBadge } from "../DocStatusBadge";
import { StatusToggle } from "../StatusToggle";
import { DeleteDocumentButton } from "../DeleteDocumentButton";
import { PermissionsEditor } from "../PermissionsEditor";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const v = { isAdmin: access.isAdmin, userId: access.user.id, userTeamKeys: access.user.teamKeys };
  const { id } = await params;
  const result = await getDocumentForUser(Number(id), v);
  if (!result) notFound();
  const { doc, level } = result;

  const canEdit = canEditContent(level);
  const canManage = canManageDocument(level);
  const [t, teams] = await Promise.all([getT(), canManage ? listTeams() : Promise.resolve([])]);
  const pdfUrl = doc.kind === "PDF" ? assetUrl(doc.assetId) : null;

  const actions = canEdit ? <Link href={`/documents/${doc.id}/edit`} className="btn-primary btn-sm">{t("docs.edit")}</Link> : undefined;

  return (
    <AppShell access={access} moduleKey="documents" pageTitle={doc.title} backHref="/documents" actions={actions}>
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <DocStatusBadge status={doc.status} label={t(`docs.status.${doc.status}`)} />
            <span className="text-xs text-muted">{t(`docs.kind.${doc.kind}`)}</span>
          </div>
          {doc.description && <p className="mb-3 whitespace-pre-wrap text-sm text-ink">{doc.description}</p>}
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div><span className="text-muted">{t("docs.category")}: </span><span className="text-ink">{doc.category?.name ?? "—"}</span></div>
            <div><span className="text-muted">{t("docs.created")}: </span><span className="text-ink">{formatBizDate(doc.createdAt)}</span></div>
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

        {canManage && (
          <PermissionsEditor documentId={doc.id} teams={teams.map((tm) => ({ key: tm.key, name: tm.name }))} current={doc.permissions} />
        )}
      </div>
    </AppShell>
  );
}
