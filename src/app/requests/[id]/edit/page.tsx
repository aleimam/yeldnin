import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { requestScopes, primaryRequestModule, requestLinesEditable } from "@/lib/requests/request-logic";
import { getRequest, getRequestItems, listScopedProducts, listCustomerOptions } from "@/lib/requests/request-service";
import { getSla } from "@/lib/sla/sla-config-service";
import { assetUrl } from "@/lib/assets/assets-service";
import { type Scope } from "@/lib/products/products-logic";
import { RequestForm, type RequestFormInitial } from "../../RequestForm";

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const { id } = await params;
  const req = await getRequest(Number(id));
  if (!req) notFound();
  const scope = req.scope as Scope;
  // Must be in-scope OPERATE and the request must still be editable (no progressed items).
  if (!requestScopes(access, "OPERATE").includes(scope)) redirect(`/requests/${req.id}`);
  const items = await getRequestItems(req.id);
  if (!requestLinesEditable(items.map((i) => i.status))) redirect(`/requests/${req.id}`);

  const [t, products, customers, sla] = await Promise.all([
    getT(),
    listScopedProducts([scope]),
    listCustomerOptions([scope]),
    getSla(),
  ]);

  const initial: RequestFormInitial = {
    type: req.type,
    scope: req.scope,
    customerId: req.customer ? String(req.customer.id) : "",
    notes: req.notes ?? "",
    deposit: req.deposit != null ? String(req.deposit) : "",
    lines: req.lines.map((l) => ({
      productId: String(l.product.id),
      count: String(l.count),
      sellingPrice: l.sellingPrice != null ? String(l.sellingPrice) : "",
      purchasePrice: l.purchasePrice != null ? String(l.purchasePrice) : "",
      purchaseCurrency: l.purchaseCurrency ?? "",
      notes: l.notes ?? "",
    })),
    photos: req.photos.map((p) => ({ id: p.assetId, url: assetUrl(p.assetId)! })),
  };

  return (
    <AppShell access={access} moduleKey={primaryRequestModule(access)} pageTitle={t("req.edit")} backHref={`/requests/${req.id}`}>
      <RequestForm allowedScopes={[scope]} products={products} customers={customers} depositPct={sla.depositPct} editId={req.id} initial={initial} />
    </AppShell>
  );
}
