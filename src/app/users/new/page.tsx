import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { CreateUserForm } from "../CreateUserForm";

export default async function NewUserPage() {
  const access = await requireCapability("user_access", "manageUsers");
  return (
    <AppShell access={access} moduleKey="user_access" pageTitle="New user" backHref="/users">
      <CreateUserForm />
    </AppShell>
  );
}
