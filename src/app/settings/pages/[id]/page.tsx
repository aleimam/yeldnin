import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getPageById } from "@/lib/content/content-pages-service";
import { PageEditor } from "../PageEditor";
import { updatePageAction, deletePageAction } from "../actions";

export default async function EditPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const access = await requireModule("settings", "MANAGE");
  const { id } = await params;
  const page = await getPageById(Number(id));
  if (!page) notFound();
  const [t, sp] = await Promise.all([getT(), searchParams]);

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={page.titleEn} backHref="/settings/pages">
      {sp.saved && (
        <div className="mb-4 max-w-4xl rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("pages.saved")}
        </div>
      )}
      <PageEditor page={page} action={updatePageAction} error={sp.error} />
      <form action={deletePageAction} className="mt-4 max-w-4xl border-t border-line pt-4">
        <input type="hidden" name="id" value={page.id} />
        <button className="text-sm text-red-600 hover:underline">{t("pages.delete")}</button>
      </form>
    </AppShell>
  );
}
