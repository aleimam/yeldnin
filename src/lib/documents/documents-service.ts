import "server-only";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/db";
import { nextUid } from "@/lib/uid";
import { clean } from "@/lib/text";
import { getLocale } from "@/i18n/server";
import { displayName } from "@/lib/users/users-logic";
import { documentAccessLevel, canViewDocument, isGrantLevel, nextVersionNo, type DocLevel } from "./documents-logic";

// Authored HTML comes from internal staff via Tiptap, but it's still stored and
// re-rendered (dangerouslySetInnerHTML), so sanitize on the server boundary.
// Colours the editor emits: #rgb / #rrggbb or rgb()/rgba(). Keep the patterns
// tight so the `style` attribute can't smuggle anything but a colour/alignment.
const COLOR = [
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
  /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
  /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)$/,
];
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s",
    "span", "mark", "ul", "ol", "li", "blockquote", "a", "code", "pre", "hr",
    "table", "thead", "tbody", "tr", "td", "th",
  ],
  allowedAttributes: {
    "*": ["style"], // needed so allowedStyles (align/colour) actually survives
    a: ["href", "target", "rel"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      color: COLOR,
      "background-color": COLOR,
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) },
};
export function sanitizeContent(html: string | null | undefined): string {
  return sanitizeHtml(html ?? "", SANITIZE_OPTS);
}

export interface DocListRow {
  id: number;
  uid: string | null;
  kind: string;
  title: string;
  description: string | null;
  status: string;
  categoryName: string | null;
  ownerId: number;
  level: DocLevel;
  reviewBy: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type DocWithRel = Awaited<ReturnType<typeof fetchDocs>>[number];
function fetchDocs(where: object) {
  return prisma.document.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { category: { select: { name: true } }, permissions: { select: { teamKey: true, level: true } } },
  });
}
function toRow(d: DocWithRel, level: DocLevel): DocListRow {
  return {
    id: d.id, uid: d.uid, kind: d.kind, title: d.title, description: d.description,
    status: d.status, categoryName: d.category?.name ?? null, ownerId: d.ownerId,
    level, reviewBy: d.reviewBy, createdAt: d.createdAt, updatedAt: d.updatedAt,
  };
}

interface Viewer { isAdmin: boolean; userId: number; userTeamKeys: string[] }
const levelOf = (d: { ownerId: number; permissions: { teamKey: string; level: string }[] }, v: Viewer): DocLevel =>
  documentAccessLevel({ isAdmin: v.isAdmin, isOwner: d.ownerId === v.userId, userTeamKeys: v.userTeamKeys, perms: d.permissions });

/** Documents the viewer can at least see, with their per-doc level. Access + draft
 *  visibility are applied in JS (per-doc ACL), then the result is paginated. */
export async function listDocumentsForUser(
  v: Viewer,
  opts: { search?: string; categoryId?: number; status?: string; skip?: number; take?: number },
): Promise<{ rows: DocListRow[]; total: number }> {
  const where = {
    archivedAt: null,
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.search ? { OR: [{ title: { contains: opts.search } }, { description: { contains: opts.search } }] } : {}),
  };
  const visible = (await fetchDocs(where))
    .map((d) => ({ d, level: levelOf(d, v) }))
    .filter(({ d, level }) => canViewDocument(d.status, level));
  const skip = opts.skip ?? 0;
  const take = opts.take ?? 50;
  return { rows: visible.slice(skip, skip + take).map(({ d, level }) => toRow(d, level)), total: visible.length };
}

/** Full document + the viewer's level; null when they can't see it. */
export async function getDocumentForUser(id: number, v: Viewer) {
  const d = await prisma.document.findFirst({
    where: { id, archivedAt: null },
    include: { category: { select: { id: true, name: true } }, permissions: { select: { teamKey: true, level: true } } },
  });
  if (!d) return null;
  const level = documentAccessLevel({ isAdmin: v.isAdmin, isOwner: d.ownerId === v.userId, userTeamKeys: v.userTeamKeys, perms: d.permissions });
  if (!canViewDocument(d.status, level)) return null;
  return { doc: d, level };
}

/** Doc + the viewer's level without the view gate — for edit/manage guards. */
export async function getDocumentAccess(id: number, v: Viewer) {
  const d = await prisma.document.findFirst({ where: { id, archivedAt: null }, include: { permissions: { select: { teamKey: true, level: true } } } });
  if (!d) return null;
  return { doc: d, level: levelOf(d, v) };
}

export interface CreateDocInput {
  kind: string; // PDF | DOC
  title: string;
  description?: string | null;
  categoryId?: number | null;
  assetId?: string | null; // PDF
  contentHtml?: string | null; // DOC
  reviewBy?: string | null;
}
/** Append an immutable snapshot of a document's current content as a new version. */
async function recordVersion(
  documentId: number,
  snap: { kind: string; title: string; contentHtml: string | null; assetId: string | null },
  editedById: number,
) {
  const agg = await prisma.documentVersion.aggregate({ where: { documentId }, _max: { versionNo: true } });
  await prisma.documentVersion.create({
    data: { documentId, versionNo: nextVersionNo(agg._max.versionNo ?? 0), kind: snap.kind, title: snap.title, contentHtml: snap.contentHtml, assetId: snap.assetId, editedById },
  });
}

export async function createDocument(input: CreateDocInput, ownerId: number) {
  const uid = await nextUid("DOC");
  const contentHtml = input.kind === "DOC" ? sanitizeContent(input.contentHtml) : null;
  const assetId = input.kind === "PDF" ? input.assetId ?? null : null;
  const doc = await prisma.document.create({
    data: {
      uid,
      kind: input.kind,
      title: input.title.trim(),
      description: clean(input.description),
      categoryId: input.categoryId ?? null,
      reviewBy: input.reviewBy ? new Date(input.reviewBy) : null,
      status: "DRAFT",
      ownerId,
      assetId,
      contentHtml,
      createdById: ownerId,
      updatedById: ownerId,
    },
    select: { id: true, title: true },
  });
  await recordVersion(doc.id, { kind: input.kind, title: doc.title, contentHtml, assetId }, ownerId);
  return { id: doc.id };
}

/** Edit the body (Operate+): DOC content or a replaced PDF file. Snapshots a version. */
export async function updateDocumentContent(id: number, input: { contentHtml?: string | null; assetId?: string | null }, userId: number) {
  const doc = await prisma.document.findUnique({ where: { id }, select: { kind: true, title: true } });
  if (!doc) return;
  const contentHtml = doc.kind === "DOC" ? sanitizeContent(input.contentHtml) : null;
  const assetId = doc.kind === "PDF" && input.assetId ? input.assetId : null;
  await prisma.document.update({
    where: { id },
    data: {
      ...(doc.kind === "DOC" ? { contentHtml } : {}),
      ...(doc.kind === "PDF" && assetId ? { assetId } : {}),
      updatedById: userId,
    },
  });
  await recordVersion(id, { kind: doc.kind, title: doc.title, contentHtml, assetId }, userId);
}

/** Edit metadata (Manage). */
export async function updateDocumentMeta(
  id: number,
  input: { title?: string; description?: string | null; categoryId?: number | null; reviewBy?: string | null },
  userId: number,
) {
  await prisma.document.update({
    where: { id },
    data: {
      ...(input.title != null ? { title: input.title.trim() } : {}),
      description: clean(input.description),
      categoryId: input.categoryId ?? null,
      reviewBy: input.reviewBy ? new Date(input.reviewBy) : null,
      updatedById: userId,
    },
  });
}

export async function setDocumentStatus(id: number, status: string, userId: number) {
  await prisma.document.update({ where: { id }, data: { status, updatedById: userId } });
}

/** Replace the document's team permissions with the given (deduped, valid) set. */
export async function setDocumentPermissions(id: number, perms: { teamKey: string; level: string }[], userId: number) {
  const valid = new Map<string, string>();
  for (const p of perms) if (p.teamKey && isGrantLevel(p.level)) valid.set(p.teamKey, p.level);
  await prisma.$transaction([
    prisma.documentPermission.deleteMany({ where: { documentId: id } }),
    ...(valid.size
      ? [prisma.documentPermission.createMany({ data: [...valid].map(([teamKey, level]) => ({ documentId: id, teamKey, level })) })]
      : []),
    prisma.document.update({ where: { id }, data: { updatedById: userId } }),
  ]);
}

export async function softDeleteDocument(id: number, userId: number) {
  await prisma.document.update({ where: { id }, data: { archivedAt: new Date(), updatedById: userId } });
}

// ── Categories (admin) ───────────────────────────────────────────────────────
export function listDocCategories() {
  return prisma.documentCategory.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export interface DocCategoryRow { id?: number; name: string; remove?: boolean }
/** Save the category list: rename/sort existing, soft-delete removed, add new. */
export async function saveDocCategories(rows: DocCategoryRow[]) {
  await prisma.$transaction(async (tx) => {
    let order = 0;
    for (const r of rows) {
      const name = r.name.trim();
      if (r.id) {
        if (r.remove) await tx.documentCategory.update({ where: { id: r.id }, data: { archivedAt: new Date() } });
        else if (name) await tx.documentCategory.update({ where: { id: r.id }, data: { name, sortOrder: order++ } });
      } else if (name && !r.remove) {
        await tx.documentCategory.create({ data: { name, sortOrder: order++ } });
      }
    }
  });
}

// ── Versions (history + restore) ─────────────────────────────────────────────
export interface DocVersionRow {
  id: number;
  versionNo: number;
  kind: string;
  editedBy: string | null;
  createdAt: Date;
}
/** A document's edit history, newest first, with the editor's display name. */
export async function listDocumentVersions(documentId: number): Promise<DocVersionRow[]> {
  const versions = await prisma.documentVersion.findMany({ where: { documentId }, orderBy: { versionNo: "desc" } });
  const ids = [...new Set(versions.map((v) => v.editedById).filter((x): x is number => x != null))];
  const [locale, users] = await Promise.all([
    getLocale(),
    ids.length ? prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, nameAr: true } }) : Promise.resolve([]),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, displayName(u, locale)]));
  return versions.map((v) => ({ id: v.id, versionNo: v.versionNo, kind: v.kind, editedBy: v.editedById ? nameOf.get(v.editedById) ?? null : null, createdAt: v.createdAt }));
}

/** Restore a prior version's content into the document (appends a new snapshot). */
export async function restoreDocumentVersion(documentId: number, versionId: number, userId: number): Promise<boolean> {
  const v = await prisma.documentVersion.findFirst({ where: { id: versionId, documentId } });
  if (!v) return false;
  await prisma.document.update({
    where: { id: documentId },
    data: { ...(v.kind === "DOC" ? { contentHtml: v.contentHtml } : { assetId: v.assetId }), updatedById: userId },
  });
  await recordVersion(documentId, { kind: v.kind, title: v.title, contentHtml: v.contentHtml, assetId: v.assetId }, userId);
  return true;
}

// ── Read acknowledgements ────────────────────────────────────────────────────
export async function acknowledgeDocument(documentId: number, userId: number) {
  await prisma.documentAck.upsert({
    where: { documentId_userId: { documentId, userId } },
    create: { documentId, userId },
    update: {},
  });
}
export function getMyAck(documentId: number, userId: number) {
  return prisma.documentAck.findUnique({ where: { documentId_userId: { documentId, userId } }, select: { acknowledgedAt: true } });
}

export interface AckAudienceRow { userId: number; name: string; acknowledgedAt: Date | null }
/** Expected readers (owner + members of teams granted access) and whether each has
 *  acknowledged — for the Manage "who has/hasn't read" view. Un-acknowledged first. */
export async function ackAudience(documentId: number): Promise<AckAudienceRow[]> {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { ownerId: true, permissions: { select: { teamKey: true } } } });
  if (!doc) return [];
  const teamKeys = doc.permissions.map((p) => p.teamKey);
  const members = teamKeys.length
    ? await prisma.teamMember.findMany({ where: { team: { key: { in: teamKeys } } }, select: { userId: true } })
    : [];
  const userIds = [...new Set([doc.ownerId, ...members.map((m) => m.userId)])];
  if (!userIds.length) return [];
  const [locale, users, acks] = await Promise.all([
    getLocale(),
    prisma.user.findMany({ where: { id: { in: userIds }, active: true, archivedAt: null }, select: { id: true, name: true, nameAr: true } }),
    prisma.documentAck.findMany({ where: { documentId, userId: { in: userIds } }, select: { userId: true, acknowledgedAt: true } }),
  ]);
  const ackOf = new Map(acks.map((a) => [a.userId, a.acknowledgedAt]));
  return users
    .map((u) => ({ userId: u.id, name: displayName(u, locale), acknowledgedAt: ackOf.get(u.id) ?? null }))
    .sort((a, b) => Number(!!a.acknowledgedAt) - Number(!!b.acknowledgedAt) || a.name.localeCompare(b.name));
}
