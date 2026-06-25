"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/access";
import { writeAudit } from "@/lib/audit";
import { isDocKind, isDocStatus, canEditContent, canManageDocument } from "@/lib/documents/documents-logic";
import {
  createDocument,
  updateDocumentContent,
  updateDocumentMeta,
  setDocumentStatus,
  setDocumentPermissions,
  softDeleteDocument,
  getDocumentAccess,
  getDocumentForUser,
  acknowledgeDocument,
  restoreDocumentVersion,
  saveDocCategories,
  type DocCategoryRow,
} from "@/lib/documents/documents-service";

type Res = { ok: true; id?: number } | { ok: false; error: string };

/** Any signed-in user may create a document (becomes its owner = MANAGE). */
export async function createDocumentAction(p: {
  kind: string;
  title: string;
  description?: string;
  categoryId?: number | null;
  assetId?: string | null;
  contentHtml?: string | null;
  reviewBy?: string | null;
}): Promise<Res> {
  const access = await requireUser();
  if (!isDocKind(p.kind)) return { ok: false, error: "Invalid document type." };
  if (!p.title?.trim()) return { ok: false, error: "A title is required." };
  if (p.kind === "PDF" && !p.assetId) return { ok: false, error: "Upload a PDF file." };
  const doc = await createDocument(
    { kind: p.kind, title: p.title, description: p.description ?? null, categoryId: p.categoryId ?? null, assetId: p.assetId ?? null, contentHtml: p.contentHtml ?? null, reviewBy: p.reviewBy ?? null },
    access.user.id,
  );
  await writeAudit(access.user.id, "documents", "document.create", "document", doc.id, { kind: p.kind });
  revalidatePath("/documents");
  return { ok: true, id: doc.id };
}

type Guard =
  | { ok: false; error: string; access?: undefined }
  | { ok: true; error?: undefined; access: Awaited<ReturnType<typeof requireUser>> };
async function guard(id: number, need: "edit" | "manage"): Promise<Guard> {
  const access = await requireUser();
  const v = { isAdmin: access.isAdmin, userId: access.user.id, userTeamKeys: access.user.teamKeys };
  const acc = await getDocumentAccess(id, v);
  if (!acc) return { ok: false, error: "Document not found." };
  const allowed = need === "manage" ? canManageDocument(acc.level) : canEditContent(acc.level);
  if (!allowed) return { ok: false, error: "You don't have permission to do that." };
  return { ok: true, access };
}

/** Edit body content (Operate+): DOC HTML or a replaced PDF file. */
export async function updateDocumentContentAction(id: number, contentHtml: string, assetId?: string | null): Promise<Res> {
  const g = await guard(id, "edit");
  if (!g.ok) return { ok: false, error: g.error };
  await updateDocumentContent(id, { contentHtml, assetId }, g.access.user.id);
  await writeAudit(g.access.user.id, "documents", "document.editContent", "document", id, {});
  revalidatePath(`/documents/${id}`);
  revalidatePath("/documents");
  return { ok: true, id };
}

/** Edit metadata (Manage). */
export async function updateDocumentMetaAction(id: number, meta: { title?: string; description?: string | null; categoryId?: number | null; reviewBy?: string | null }): Promise<Res> {
  const g = await guard(id, "manage");
  if (!g.ok) return { ok: false, error: g.error };
  await updateDocumentMeta(id, meta, g.access.user.id);
  await writeAudit(g.access.user.id, "documents", "document.editMeta", "document", id, {});
  revalidatePath(`/documents/${id}`);
  revalidatePath("/documents");
  return { ok: true, id };
}

export async function setDocumentStatusAction(id: number, status: string): Promise<Res> {
  if (!isDocStatus(status)) return { ok: false, error: "Invalid status." };
  const g = await guard(id, "manage");
  if (!g.ok) return { ok: false, error: g.error };
  await setDocumentStatus(id, status, g.access.user.id);
  await writeAudit(g.access.user.id, "documents", "document.status", "document", id, { status });
  revalidatePath(`/documents/${id}`);
  revalidatePath("/documents");
  return { ok: true, id };
}

export async function setDocumentPermissionsAction(id: number, perms: { teamKey: string; level: string }[]): Promise<Res> {
  const g = await guard(id, "manage");
  if (!g.ok) return { ok: false, error: g.error };
  await setDocumentPermissions(id, perms, g.access.user.id);
  await writeAudit(g.access.user.id, "documents", "document.permissions", "document", id, { count: perms.length });
  revalidatePath(`/documents/${id}`);
  return { ok: true, id };
}

export async function deleteDocumentAction(id: number): Promise<Res> {
  const g = await guard(id, "manage");
  if (!g.ok) return { ok: false, error: g.error };
  await softDeleteDocument(id, g.access.user.id);
  await writeAudit(g.access.user.id, "documents", "document.delete", "document", id, {});
  revalidatePath("/documents");
  return { ok: true, id };
}

/** Any viewer acknowledges they've read a published document. */
export async function acknowledgeDocumentAction(id: number): Promise<Res> {
  const access = await requireUser();
  const acc = await getDocumentForUser(id, { isAdmin: access.isAdmin, userId: access.user.id, userTeamKeys: access.user.teamKeys });
  if (!acc) return { ok: false, error: "Document not found." };
  if (acc.doc.status !== "PUBLISHED") return { ok: false, error: "Only published documents can be acknowledged." };
  await acknowledgeDocument(id, access.user.id);
  await writeAudit(access.user.id, "documents", "document.acknowledge", "document", id, {});
  revalidatePath(`/documents/${id}`);
  return { ok: true, id };
}

/** Restore a prior version (Manage). */
export async function restoreVersionAction(id: number, versionId: number): Promise<Res> {
  const g = await guard(id, "manage");
  if (!g.ok) return { ok: false, error: g.error };
  const ok = await restoreDocumentVersion(id, versionId, g.access.user.id);
  if (!ok) return { ok: false, error: "Version not found." };
  await writeAudit(g.access.user.id, "documents", "document.restore", "document", id, { versionId });
  revalidatePath(`/documents/${id}`);
  revalidatePath("/documents");
  return { ok: true, id };
}

/** Manage the category list (admins only). */
export async function saveDocCategoriesAction(rows: DocCategoryRow[]): Promise<Res> {
  const access = await requireUser();
  if (!access.isAdmin) return { ok: false, error: "Admins only." };
  await saveDocCategories(rows);
  await writeAudit(access.user.id, "documents", "category.save", "documentCategory", "batch", {});
  revalidatePath("/documents/categories");
  revalidatePath("/documents");
  return { ok: true };
}
