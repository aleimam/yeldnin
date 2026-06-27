import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { canEditContent, canManageDocument, type DocKind } from "@/lib/documents/documents-logic";
import { getDocumentAccess, listDocCategories } from "@/lib/documents/documents-service";
import { DocumentForm } from "../../DocumentForm";

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const v = { isAdmin: access.isAdmin, userId: access.user.id, userTeamKeys: access.user.teamKeys };
  const { id } = await params;
  const docId = Number(id);
  const result = await getDocumentAccess(docId, v);
  if (!result || !canEditContent(result.level)) redirect(`/documents/${id}`);
  const { doc, level } = result;

  const [t, categories] = await Promise.all([getT(), listDocCategories()]);

  return (
    <AppShell access={access} moduleKey="documents" pageTitle={t("docs.editTitle")} backHref={`/documents/${docId}`}>
      <DocumentForm
        categories={categories}
        editId={docId}
        canManageMeta={canManageDocument(level)}
        initial={{
          kind: doc.kind as DocKind,
          title: doc.title,
          description: doc.description ?? "",
          categoryId: doc.categoryId ?? null,
          contentHtml: doc.contentHtml ?? "",
          assetId: doc.assetId ?? null,
          reviewBy: doc.reviewBy ? doc.reviewBy.toISOString().slice(0, 10) : null,
          creationDate: (doc.creationDate ?? doc.createdAt).toISOString().slice(0, 10),
        }}
      />
    </AppShell>
  );
}
