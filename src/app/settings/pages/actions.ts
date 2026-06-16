"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import {
  createPage,
  updatePage,
  deletePage,
  type ContentPageInput,
} from "@/lib/content/content-pages-service";

function parse(fd: FormData): ContentPageInput {
  return {
    slug: String(fd.get("slug") ?? ""),
    titleEn: String(fd.get("titleEn") ?? ""),
    titleAr: String(fd.get("titleAr") ?? ""),
    bodyEn: String(fd.get("bodyEn") ?? ""),
    bodyAr: String(fd.get("bodyAr") ?? ""),
    visibility: String(fd.get("visibility") ?? "PUBLIC"),
    published: fd.get("published") === "on",
    showInFooter: fd.get("showInFooter") === "on",
    showInMenu: fd.get("showInMenu") === "on",
    sortOrder: Number(fd.get("sortOrder")) || 0,
  };
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Could not save the page.");

export async function createPageAction(fd: FormData): Promise<void> {
  const access = await requireModule("settings", "MANAGE");
  let newId: number;
  try {
    const page = await createPage(parse(fd), access.user.id);
    newId = page.id;
  } catch (e) {
    redirect(`/settings/pages/new?error=${encodeURIComponent(errMsg(e))}`);
  }
  revalidatePath("/", "layout"); // footer may change
  redirect(`/settings/pages/${newId}`);
}

export async function updatePageAction(fd: FormData): Promise<void> {
  const access = await requireModule("settings", "MANAGE");
  const id = Number(fd.get("id"));
  try {
    await updatePage(id, parse(fd), access.user.id);
  } catch (e) {
    redirect(`/settings/pages/${id}?error=${encodeURIComponent(errMsg(e))}`);
  }
  revalidatePath("/", "layout");
  redirect(`/settings/pages/${id}?saved=1`);
}

export async function deletePageAction(fd: FormData): Promise<void> {
  const access = await requireModule("settings", "MANAGE");
  const id = Number(fd.get("id"));
  if (id) await deletePage(id, access.user.id);
  revalidatePath("/", "layout");
  redirect("/settings/pages");
}
