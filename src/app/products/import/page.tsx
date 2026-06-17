import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes, primaryProductModule } from "@/lib/products/products-logic";
import { ImportForm } from "./ImportForm";

export default async function ProductImportPage() {
  const access = await requireUser();
  const scopes = productScopes(access, "OPERATE");
  if (!scopes.length) redirect("/products");
  const t = await getT();
  return (
    <AppShell access={access} moduleKey={primaryProductModule(access)} pageTitle={t("pimport.title")} backHref="/products">
      <ImportForm scopes={scopes} />
    </AppShell>
  );
}
