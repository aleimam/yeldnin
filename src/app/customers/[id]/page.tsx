import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getCustomer } from "@/lib/customers/customers-service";
import { CustomerForm } from "../CustomerForm";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("order_requests", "OPERATE");
  const { id } = await params;
  const c = await getCustomer(Number(id));
  if (!c) notFound();
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="order_requests" pageTitle={c.name} backHref="/customers">
      <CustomerForm
        mode="edit"
        initial={{ id: c.id, name: c.name, contactChannel: c.contactChannel, contactNumber: c.contactNumber ?? "", notes: c.notes ?? "", active: c.active }}
      />
    </AppShell>
  );
}
