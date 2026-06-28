import Link from "next/link";
import type { ItemProvenance } from "@/lib/items/items-service";
import type { ItemStatus } from "@/lib/workflow/workflow-logic";

interface InvItem {
  id: number;
  status: string;
  product: { id: number; name: string };
}

/**
 * Inventory item list for a trip/hub. Shows the product (with its source Purchase
 * and Dispatch as links), then the status — no item UID (that lives on the item's
 * own detail page). Long product names wrap. Server component (called during the
 * page's server render, so `label`/`t` are passed in directly).
 */
export function InventoryTable({
  items,
  prov,
  label,
  t,
  emptyKey,
}: {
  items: InvItem[];
  prov: Map<number, ItemProvenance>;
  label: (s: ItemStatus) => string;
  t: (k: string) => string;
  emptyKey: string;
}) {
  return (
    <table className="w-full text-sm" data-cards>
      <thead>
        <tr className="border-b border-line">
          <th className="th">{t("requests.product")}</th>
          <th className="th">{t("requests.status")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {items.map((it) => {
          const p = prov.get(it.id);
          return (
            <tr key={it.id}>
              <td className="td" data-label={t("requests.product")}>
                <Link href={`/products/${it.product.id}`} className="prodname font-medium text-brand hover:underline">
                  {it.product.name}
                </Link>
                {(p?.purchase || p?.patch) && (
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    {p?.purchase && (
                      <Link href={`/purchasing/purchases/${p.purchase.id}`} className="hover:text-brand hover:underline">
                        {t("item.purchase")}: {p.purchase.uid ?? `#${p.purchase.id}`}
                      </Link>
                    )}
                    {p?.patch && (
                      <Link href={`/patches/${p.patch.id}`} className="hover:text-brand hover:underline">
                        {t("item.dispatch")}: {p.patch.uid ?? `#${p.patch.id}`}
                      </Link>
                    )}
                  </div>
                )}
              </td>
              <td className="td" data-label={t("requests.status")}>{label(it.status as ItemStatus)}</td>
            </tr>
          );
        })}
        {items.length === 0 && (
          <tr>
            <td className="td text-muted" colSpan={2}>{t(emptyKey)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
