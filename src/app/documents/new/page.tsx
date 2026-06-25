import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listDocCategories } from "@/lib/documents/documents-service";
import { DocumentForm } from "../DocumentForm";

export default async function NewDocumentPage() {
  const access = await requireUser();
  const [t, categories] = await Promise.all([getT(), listDocCategories()]);
  return (
    <AppShell access={access} moduleKey="documents" pageTitle={t("docs.new")} backHref="/documents">
      <DocumentForm categories={categories} />
    </AppShell>
  );
}
