import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getCustomer } from "@/lib/customers/customers-service";
import { customerScopes, primaryCustomerModule } from "@/lib/customers/customers-logic";
import { CustomerForm } from "../CustomerForm";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  const allowed = customerScopes(access, "OPERATE");
  const { id } = await params;
  const c = await getCustomer(Number(id));
  // GOLDEN RULE: 404 for BOTH missing and off-scope. Redirecting only the
  // off-scope case told a Sales user which customer ids exist in XOONX — they
  // could distinguish the two outcomes by the response alone.
  if (!c || !allowed.includes(c.scope as never)) notFound();
  const t = await getT();
  return (
    <AppShell access={access} moduleKey={primaryCustomerModule(access)} pageTitle={c.name} backHref="/customers">
      <CustomerForm
        mode="edit"
        allowedScopes={allowed}
        initial={{ id: c.id, name: c.name, scope: c.scope, contactChannel: c.contactChannel, contactNumber: c.contactNumber ?? "", notes: c.notes ?? "", active: c.active }}
      />
    </AppShell>
  );
}
