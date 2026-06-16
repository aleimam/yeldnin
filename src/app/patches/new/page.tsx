import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { SCOPES } from "@/lib/products/products-logic";
import { listPurchasesWithOrdered, getPurchaseOrderedItems } from "@/lib/patches/patch-service";
import { PatchForm } from "../PatchForm";

export default async function NewPatchPage() {
  const access = await requireModule("logistics", "OPERATE");
  const t = await getT();
  const purchases = await listPurchasesWithOrdered([...SCOPES]);
  const withItems = await Promise.all(
    purchases.map(async (p) => ({
      id: p.id,
      label: `${p.uid ?? p.id} · ${p.supplierName ?? "—"} → ${p.destinationName ?? "—"} (${p.orderedCount})`,
      items: (await getPurchaseOrderedItems(p.id)).map((it) => ({ id: it.id, productName: it.product.name })),
    })),
  );

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("patches.new")} backHref="/patches">
      <PatchForm purchases={withItems} />
    </AppShell>
  );
}
