import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { CreateUserForm } from "../CreateUserForm";

export default async function NewUserPage() {
  const access = await requireCapability("user_access", "manageUsers");
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="user_access" pageTitle={t("users.newUser")} backHref="/users">
      <CreateUserForm />
    </AppShell>
  );
}
