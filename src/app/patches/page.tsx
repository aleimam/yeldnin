import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { SCOPES } from "@/lib/products/products-logic";
import { listPatches } from "@/lib/patches/patch-service";

export default async function PatchesPage() {
  const access = await requireModule("logistics", "VIEW");
  const canManage = access.can("logistics", "operate");
  const [t, rows] = await Promise.all([getT(), listPatches({ scopes: [...SCOPES] })]);
  return (
    <AppShell
      access={access}
      moduleKey="logistics"
      pageTitle={t("patches.title")}
      actions={canManage ? <Link href="/patches/new" className="btn-primary">+ {t("patches.new")}</Link> : null}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("patches.uid")}</th>
              <th className="th">{t("patches.supplier")}</th>
              <th className="th">{t("patches.destination")}</th>
              <th className="th">{t("patches.tracking")}</th>
              <th className="th">{t("patches.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-canvas/60">
                <td className="td font-mono text-xs text-muted">
                  <Link href={`/patches/${p.id}`} className="text-brand hover:underline">{p.uid ?? p.id}</Link>
                </td>
                <td className="td text-muted">{p.supplierName ?? "—"} · {p.country}</td>
                <td className="td text-muted">{p.destinationName ?? "—"}</td>
                <td className="td text-muted">{p.tracking ?? "—"}</td>
                <td className="td">{t(`patchstatus.${p.status}`)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("patches.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
