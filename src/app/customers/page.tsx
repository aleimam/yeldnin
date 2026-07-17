import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { cookies } from "next/headers";
import { listCustomers } from "@/lib/customers/customers-service";
import { customerScopes, primaryCustomerModule } from "@/lib/customers/customers-logic";
import { moduleContextScopes } from "@/lib/module-context";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { CustomersFilters } from "./CustomersFilters";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireUser();
  const visible = customerScopes(access, "VIEW");
  if (!visible.length) redirect("/");
  const sp = await searchParams;
  const ctx = typeof sp.m === "string" && access.canModule(sp.m, "VIEW") ? sp.m : null;
  const moduleKey = ctx ?? primaryCustomerModule(access);
  const ctxScopes = ctx ? moduleContextScopes(ctx) : null;
  const baseScopes = ctxScopes ? visible.filter((s) => ctxScopes.includes(s)) : visible;
  const scopes = sp.scope && (baseScopes as string[]).includes(sp.scope) ? [sp.scope] : baseScopes;
  // The detail route IS the edit form (OPERATE-gated), so only link rows the
  // viewer can actually open — a VIEW-only user otherwise just bounces back.
  const editableScopes = customerScopes(access, "OPERATE") as string[];
  const canManage = editableScopes.length > 0;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }] = await Promise.all([getT(), listCustomers({ scopes, search: sp.q, sort: sp.sort, skip, take })]);
  return (
    <AppShell
      access={access}
      moduleKey={moduleKey}
      pageTitle={t("customers.title")}
      actions={canManage ? <Link href="/customers/new" className="btn-primary">+ {t("customers.new")}</Link> : null}
    >
      <CustomersFilters
        basePath="/customers"
        current={{ q: sp.q ?? "", scope: sp.scope ?? "", sort: sp.sort ?? "" }}
        scopes={baseScopes}
        m={ctx ?? undefined}
      />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("customers.name")}</th>
              <th className="th">{t("requests.scope")}</th>
              <th className="th">{t("customers.channel")}</th>
              <th className="th">{t("customers.number")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-canvas/60">
                <td className="td" data-label={t("customers.name")}>
                  {editableScopes.includes(c.scope) ? (
                    <Link href={`/customers/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link>
                  ) : (
                    <span className="font-medium text-ink">{c.name}</span>
                  )}
                  {!c.active && <span className="ms-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("customers.inactive")}</span>}
                </td>
                <td className="td text-muted" data-label={t("requests.scope")}>{t(`scope.${c.scope}`)}</td>
                <td className="td text-muted" data-label={t("customers.channel")}>{t(`channel.${c.contactChannel}`)}</td>
                <td className="td text-muted" data-label={t("customers.number")}>{c.contactNumber ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("customers.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator basePath="/customers" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
