import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { SCOPES } from "@/lib/products/products-logic";
import { listPatches } from "@/lib/patches/patch-service";
import { categoryCountsByContainerHistory } from "@/lib/items/items-service";
import { categoryLabels, emptyCategoryCounts } from "@/lib/items/items-logic";
import { worstSlaByCurrentContainer } from "@/lib/sla/sla-service";
import { slaRowClass } from "@/lib/sla/sla-logic";
import { ItemCounts } from "@/components/ItemCounts";

export default async function PatchesPage() {
  const access = await requireModule("logistics", "VIEW");
  const canManage = access.can("logistics", "operate");
  const [t, rows] = await Promise.all([getT(), listPatches({ scopes: [...SCOPES] })]);
  const ids = rows.map((r) => r.id);
  const [counts, sla] = await Promise.all([
    categoryCountsByContainerHistory("PATCH", ids),
    worstSlaByCurrentContainer("PATCH", ids),
  ]);
  const labels = categoryLabels(t);
  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("patches.title")}
      actions={canManage ? <Link href="/patches/new" className="btn-primary">+ {t("patches.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full" data-cards>
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("patches.patch")}</th>
              <th className="th">{t("requests.items")}</th>
              <th className="th">{t("patches.tracking")}</th>
              <th className="th">{t("patches.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className={`hover:bg-canvas/60 ${slaRowClass(sla.get(p.id))}`}>
                <td className="td" data-label={t("patches.patch")}>
                  <Link href={`/patches/${p.id}`} className="text-brand hover:underline">
                    {t("patch.friendly", { count: counts.get(p.id)?.total ?? 0, supplier: p.supplierName ?? "—", dest: p.destinationName ?? "—" })}
                  </Link>
                  <div className="font-mono text-xs text-muted">{p.uid ?? p.id} · {p.country}</div>
                </td>
                <td className="td" data-label={t("requests.items")}><ItemCounts counts={counts.get(p.id) ?? emptyCategoryCounts()} labels={labels} /></td>
                <td className="td text-muted" data-label={t("patches.tracking")}>{p.tracking ?? "—"}</td>
                <td className="td" data-label={t("patches.status")}>{t(`patchstatus.${p.status}`)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("patches.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
