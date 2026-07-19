import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { customerScopes, primaryCustomerModule } from "@/lib/customers/customers-logic";
import { CustomerForm } from "../CustomerForm";

export default async function NewCustomerPage() {
  const access = await requireUser();
  // VEEEY customers come from the storefront via the sync — not hand-created here.
  const allowed = customerScopes(access, "OPERATE").filter((s) => s !== "VEEEY");
  if (!allowed.length) redirect("/");
  const t = await getT();
  return (
    <AppShell access={access} moduleKey={primaryCustomerModule(access)} pageTitle={t("customers.new")} backHref="/customers">
      <CustomerForm
        mode="create"
        allowedScopes={allowed}
        initial={{ name: "", scope: allowed[0], contactChannel: "WHATSAPP", contactNumber: "", notes: "", active: true }}
      />
    </AppShell>
  );
}
