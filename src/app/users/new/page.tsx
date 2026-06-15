import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { CreateUserForm } from "../CreateUserForm";

export default async function NewUserPage() {
  const access = await requireModule("user_access", "MANAGE");
  return (
    <AppShell access={access} moduleKey="user_access" pageTitle="New user" backHref="/users">
      <CreateUserForm />
    </AppShell>
  );
}
