import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { requestScopes, primaryRequestModule } from "@/lib/requests/request-logic";
import { requestPool } from "@/lib/requests/request-service";
import { moduleContextScopes } from "@/lib/module-context";
import { ListSearch } from "@/components/ListSearch";
import { RequestsTabs } from "../RequestsTabs";
import { RequestProductsTable } from "../RequestProductsTable";

// Tab 2 — Requested products: every product that's been requested (one row each),
// with its journey-stage breakdown. Click a product to open its detail page.
export default async function RequestedProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireUser();
  const visible = requestScopes(access, "VIEW");
  if (!visible.length) redirect("/");
  const sp = await searchParams;
  const ctx = typeof sp.m === "string" && access.canModule(sp.m, "VIEW") ? sp.m : null;
  const moduleKey = ctx ?? primaryRequestModule(access);
  const ctxScopes = ctx ? moduleContextScopes(ctx) : null;
  const scopes = ctxScopes ? visible.filter((s) => ctxScopes.includes(s)) : visible;
  const [t, pool] = await Promise.all([getT(), requestPool(scopes, { search: sp.q })]);

  return (
    <AppShell access={access} moduleKey={moduleKey} pageTitle={t("requests.products")} backHref="/requests">
      <RequestsTabs active="products" m={ctx ?? ""} t={t} />
      <ListSearch basePath="/requests/products" value={sp.q ?? ""} placeholder={t("rpool.search")} extra={{ m: ctx ?? undefined }} />
      <RequestProductsTable rows={pool} t={t} empty={t("rpool.empty")} />
    </AppShell>
  );
}
