import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { SCOPES } from "@/lib/products/products-logic";
import { listPurchasesWithOrdered, getPurchaseOrderedItems } from "@/lib/patches/patch-service";
import { listCarriersForPicker } from "@/lib/carriers/carriers-service";
import { PatchForm } from "../PatchForm";

export default async function NewPatchPage({ searchParams }: { searchParams: Promise<{ purchase?: string }> }) {
  const access = await requireCapability("logistics", "operate");
  const sp = await searchParams;
  const [t, purchases, carriers] = await Promise.all([
    getT(),
    listPurchasesWithOrdered([...SCOPES]),
    listCarriersForPicker(),
  ]);
  const withItems = await Promise.all(
    purchases.map(async (p) => ({
      id: p.id,
      label: `${p.uid ?? p.id} · ${p.supplierName ?? "—"} → ${p.destinationName ?? "—"} (${p.orderedCount})`,
      items: (await getPurchaseOrderedItems(p.id)).map((it) => ({ id: it.id, productName: it.product.name })),
    })),
  );

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("patches.new")} backHref="/patches">
      <PatchForm purchases={withItems} carriers={carriers} initialPurchaseId={sp.purchase} />
    </AppShell>
  );
}
