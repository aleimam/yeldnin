import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { requestScopes, primaryRequestModule } from "@/lib/requests/request-logic";
import { requestPool, type RequestPoolRow } from "@/lib/requests/request-service";
import { moduleContextScopes } from "@/lib/module-context";
import { ListSearch } from "@/components/ListSearch";
import { RequestsTabs } from "../RequestsTabs";

const SORT_KEYS = ["product", "scope", "requested", "ongoing", "delivered", "errant"] as const;
type SortKey = (typeof SORT_KEYS)[number];

export default async function RequestPoolPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireUser();
  const visible = requestScopes(access, "VIEW");
  if (!visible.length) redirect("/");
  const sp = await searchParams;
  const ctx = typeof sp.m === "string" && access.canModule(sp.m, "VIEW") ? sp.m : null;
  const moduleKey = ctx ?? primaryRequestModule(access);
  const ctxScopes = ctx ? moduleContextScopes(ctx) : null;
  const scopes = ctxScopes ? visible.filter((s) => ctxScopes.includes(s)) : visible;
  const sort = (SORT_KEYS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as SortKey) : "requested";
  const dir = sp.dir === "asc" ? "asc" : "desc";

  const [t, pool] = await Promise.all([getT(), requestPool(scopes, sp.q)]);
  const cmp: Record<SortKey, (a: RequestPoolRow, b: RequestPoolRow) => number> = {
    product: (a, b) => a.productName.localeCompare(b.productName),
    scope: (a, b) => a.scope.localeCompare(b.scope),
    requested: (a, b) => a.requested - b.requested,
    ongoing: (a, b) => a.ongoing - b.ongoing,
    delivered: (a, b) => a.delivered - b.delivered,
    errant: (a, b) => a.errant - b.errant,
  };
  const rows = [...pool].sort(cmp[sort]);
  if (dir === "desc") rows.reverse();

  const sortHref = (key: string) => {
    const p = new URLSearchParams();
    for (const k of ["q", "m"] as const) {
      const v = sp[k];
      if (v) p.set(k, v);
    }
    p.set("sort", key);
    p.set("dir", sort === key && dir === "desc" ? "asc" : "desc");
    return `/requests/pool?${p.toString()}`;
  };
  const arrow = (key: string) => (sort === key ? (dir === "desc" ? " ↓" : " ↑") : "");
  const th = (key: string, label: string, end = false) => (
    <th className={`th ${end ? "text-end" : ""}`}><Link href={sortHref(key)} className="hover:text-brand">{label}{arrow(key)}</Link></th>
  );

  return (
    <AppShell access={access} moduleKey={moduleKey} pageTitle={t("requests.pool")}>
      <RequestsTabs active="pool" m={ctx ?? ""} t={t} />
      <ListSearch basePath="/requests/pool" value={sp.q ?? ""} placeholder={t("rpool.search")} />
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              {th("scope", t("requests.scope"))}
              {th("product", t("requests.product"))}
              {th("requested", t("rpool.requested"), true)}
              {th("ongoing", t("rpool.ongoing"), true)}
              {th("delivered", t("rpool.delivered"), true)}
              {th("errant", t("rpool.errant"), true)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={`${p.scope}:${p.productId}`} className="hover:bg-canvas/60">
                <td className="td text-muted" data-label={t("requests.scope")}>{t(`scope.${p.scope}`)}</td>
                <td className="td" data-label={t("requests.product")}><Link href={`/products/${p.productId}`} className="prodname text-brand hover:underline">{p.productName}</Link></td>
                <td className="td text-end font-semibold text-ink" data-label={t("rpool.requested")}>{p.requested}</td>
                <td className="td text-end text-muted" data-label={t("rpool.ongoing")}>{p.ongoing}</td>
                <td className="td text-end text-muted" data-label={t("rpool.delivered")}>{p.delivered}</td>
                <td className={`td text-end ${p.errant > 0 ? "font-medium text-red-600" : "text-muted"}`} data-label={t("rpool.errant")}>{p.errant}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("rpool.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
