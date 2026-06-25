import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listDocCategories } from "@/lib/documents/documents-service";
import { CategoriesEditor } from "../CategoriesEditor";

export default async function DocCategoriesPage() {
  const access = await requireUser();
  if (!access.isAdmin) redirect("/documents");
  const [t, categories] = await Promise.all([getT(), listDocCategories()]);
  return (
    <AppShell access={access} moduleKey="documents" pageTitle={t("docs.cat.title")} backHref="/documents">
      <CategoriesEditor initial={categories.map((c) => ({ id: c.id, name: c.name }))} />
    </AppShell>
  );
}
