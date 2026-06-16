import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const SLUG_RE = /^[a-z0-9-]+$/;
function normalizeSlug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export interface ContentPageInput {
  slug: string;
  titleEn: string;
  titleAr?: string;
  bodyEn?: string;
  bodyAr?: string;
  visibility?: string;
  published?: boolean;
  showInFooter?: boolean;
  showInMenu?: boolean;
  sortOrder?: number;
}

function validate(input: ContentPageInput): { slug: string } {
  const slug = normalizeSlug(input.slug || "");
  if (!slug || !SLUG_RE.test(slug)) {
    throw new Error("Slug must be lower-case letters, numbers and dashes (e.g. privacy-policy).");
  }
  if (!input.titleEn?.trim()) throw new Error("English title is required.");
  if (input.visibility && !["PUBLIC", "INTERNAL"].includes(input.visibility)) {
    throw new Error("Invalid visibility.");
  }
  return { slug };
}

export function listPages() {
  return prisma.contentPage.findMany({ orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] });
}
export function getPageById(id: number) {
  return prisma.contentPage.findUnique({ where: { id } });
}
export function getPublishedPageBySlug(slug: string) {
  return prisma.contentPage.findFirst({ where: { slug, published: true } });
}
export function listFooterPages() {
  return prisma.contentPage.findMany({
    where: { published: true, showInFooter: true },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, titleEn: true, titleAr: true },
  });
}

function dataFrom(input: ContentPageInput, slug: string) {
  return {
    slug,
    titleEn: input.titleEn.trim(),
    titleAr: input.titleAr?.trim() ?? "",
    bodyEn: input.bodyEn ?? "",
    bodyAr: input.bodyAr ?? "",
    visibility: input.visibility === "INTERNAL" ? "INTERNAL" : "PUBLIC",
    published: !!input.published,
    showInFooter: input.showInFooter ?? true,
    showInMenu: input.showInMenu ?? true,
    sortOrder: input.sortOrder ?? 0,
  };
}

export async function createPage(input: ContentPageInput, userId: number) {
  const { slug } = validate(input);
  if (await prisma.contentPage.findUnique({ where: { slug } })) {
    throw new Error(`A page with the slug "${slug}" already exists.`);
  }
  const page = await prisma.contentPage.create({
    data: { ...dataFrom(input, slug), createdById: userId },
  });
  await writeAudit(userId, "settings", "page.create", "contentPage", page.id, { slug });
  return page;
}

export async function updatePage(id: number, input: ContentPageInput, userId: number) {
  const { slug } = validate(input);
  const clash = await prisma.contentPage.findFirst({ where: { slug, id: { not: id } }, select: { id: true } });
  if (clash) throw new Error(`A page with the slug "${slug}" already exists.`);
  const page = await prisma.contentPage.update({
    where: { id },
    data: { ...dataFrom(input, slug), updatedById: userId },
  });
  await writeAudit(userId, "settings", "page.update", "contentPage", id, { slug });
  return page;
}

export async function deletePage(id: number, userId: number) {
  const page = await prisma.contentPage.findUnique({ where: { id }, select: { slug: true } });
  await prisma.contentPage.delete({ where: { id } });
  await writeAudit(userId, "settings", "page.delete", "contentPage", id, { slug: page?.slug });
}
