import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { managerOptions } from "@/lib/hr/hr-service";
import { EmployeeCreateForm } from "../../EmployeeCreateForm";

export default async function NewEmployeePage() {
  const access = await requireUser();
  if (!access.isAdmin && !access.can("human_resources", "operate")) redirect("/hr/employees");
  const [t, managers] = await Promise.all([getT(), managerOptions()]);
  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("hr.addEmployee")} backHref="/hr/employees">
      <div className="max-w-2xl">
        <EmployeeCreateForm managers={managers} />
      </div>
    </AppShell>
  );
}
