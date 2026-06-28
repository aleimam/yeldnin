import Link from "next/link";
import { PRODUCT_STAGES } from "@/lib/items/items-logic";
import type { RequestPoolRow } from "@/lib/requests/request-service";

/** Per-product journey-stage table — shared by the Requested-products and the
 *  Request-pool tabs. Columns: Scope · Product · the 7 stages. */
export function RequestProductsTable({ rows, t, empty }: { rows: RequestPoolRow[]; t: (k: string) => string; empty: string }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm" data-cards>
        <thead className="border-b border-line bg-canvas">
          <tr>
            <th className="th">{t("requests.scope")}</th>
            <th className="th">{t("requests.product")}</th>
            {PRODUCT_STAGES.map((s) => <th key={s} className="th text-end">{t(`pstage.${s}`)}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={`${r.scope}:${r.productId}`} className="hover:bg-canvas/60">
              <td className="td text-muted" data-label={t("requests.scope")}>{t(`scope.${r.scope}`)}</td>
              <td className="td" data-label={t("requests.product")}>
                <Link href={`/products/${r.productId}`} className="prodname text-brand hover:underline">{r.productName}</Link>
              </td>
              {PRODUCT_STAGES.map((s) => (
                <td key={s} className={`td text-end ${s === "problems" && r.stages[s] > 0 ? "font-medium text-red-600" : "text-muted"}`} data-label={t(`pstage.${s}`)}>
                  {r.stages[s] || "—"}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="td text-muted" colSpan={2 + PRODUCT_STAGES.length}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
