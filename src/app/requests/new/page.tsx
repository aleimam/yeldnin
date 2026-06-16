import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { requestScopes, primaryRequestModule } from "@/lib/requests/request-logic";
import { listScopedProducts, listCustomerOptions } from "@/lib/requests/request-service";
import { RequestForm } from "../RequestForm";

export default async function NewRequestPage() {
  const access = await requireUser();
  const allowed = requestScopes(access, "OPERATE");
  if (!allowed.length) redirect("/");
  const [t, products, customers] = await Promise.all([getT(), listScopedProducts(allowed), listCustomerOptions(allowed)]);

  return (
    <AppShell access={access} moduleKey={primaryRequestModule(access)} pageTitle={t("requests.new")} backHref="/requests">
      <RequestForm allowedScopes={allowed} products={products} customers={customers} />
    </AppShell>
  );
}
