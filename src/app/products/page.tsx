import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { productScopes, primaryProductModule } from "@/lib/products/products-logic";
import { listProducts, productPipelineStats } from "@/lib/products/products-service";
import { moduleContextScopes } from "@/lib/module-context";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const access = await requireUser();
  const visible = productScopes(access, "VIEW");
  if (!visible.length) redirect("/");
  const sp = await searchParams;
  const ctx = typeof sp.m === "string" && access.canModule(sp.m, "VIEW") ? sp.m : null;
  const moduleKey = ctx ?? primaryProductModule(access);
  const ctxScopes = ctx ? moduleContextScopes(ctx) : null;
  const scopes = ctxScopes ? visible.filter((s) => ctxScopes.includes(s)) : visible;
  const canManage = productScopes(access, "OPERATE").length > 0;
  const [t, rows] = await Promise.all([getT(), listProducts({ scopes })]);
  const stats = await productPipelineStats(rows.map((r) => r.id));

  return (
    <AppShell
      access={access}
      moduleKey={moduleKey}
      pageTitle={t("products.title")}
      actions={
        canManage ? (
          <div className="flex gap-2">
            <Link href="/products/import" className="btn-secondary">{t("products.import")}</Link>
            <Link href="/products/new" className="btn-primary">+ {t("products.new")}</Link>
          </div>
        ) : null
      }
    >
      <div className="card overflow-x-auto">
        <table className="w-full table-cards">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("products.sku")}</th>
              <th className="th">{t("products.name")}</th>
              <th className="th">{t("products.scope")}</th>
              <th className="th">{t("products.type")}</th>
              <th className="th">{t("products.supplier")}</th>
              <th className="th text-end">{t("products.requested")}</th>
              <th className="th text-end">{t("products.inPipeline")}</th>
              <th className="th text-end">{t("products.arrived")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => {
              const s = stats.get(p.id);
              return (
              <tr key={p.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted" data-label={t("products.sku")}>{p.sku ?? "—"}</td>
                <td className="td" data-label={t("products.name")}>
                  <Link href={`/products/${p.id}`} className="font-medium text-brand hover:underline">
                    {p.name}
                  </Link>
                  {p._count.photos > 0 && <span className="ms-2 text-xs text-muted">📎{p._count.photos}</span>}
                  {!p.active && <span className="ms-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("products.inactive")}</span>}
                </td>
                <td className="td" data-label={t("products.scope")}>{t(`scope.${p.scope}`)}</td>
                <td className="td text-muted" data-label={t("products.type")}>{t(`ptype.${p.type}`)}</td>
                <td className="td text-muted" data-label={t("products.supplier")}>{p.defaultSupplier?.name ?? "—"}</td>
                <td className="td text-end text-muted" data-label={t("products.requested")}>{s?.requested || "—"}</td>
                <td className="td text-end text-muted" data-label={t("products.inPipeline")}>{s?.inPipeline || "—"}</td>
                <td className="td text-end text-muted" data-label={t("products.arrived")}>{s ? `${s.arrived30} / ${s.arrived90}` : "—"}</td>
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td className="td text-muted" colSpan={8}>{t("products.empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
