import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { CustomerForm } from "../CustomerForm";

export default async function NewCustomerPage() {
  const access = await requireModule("order_requests", "OPERATE");
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="order_requests" pageTitle={t("customers.new")} backHref="/customers">
      <CustomerForm mode="create" initial={{ name: "", contactChannel: "WHATSAPP", contactNumber: "", notes: "", active: true }} />
    </AppShell>
  );
}
