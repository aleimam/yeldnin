import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listDepartments, listPositions } from "@/lib/hr/positions-service";
import { PositionsAdmin } from "./PositionsAdmin";

// Admin-managed org structure: Departments + Positions. HR-manage (or admin).
export default async function PositionsPage() {
  const access = await requireUser();
  if (!(access.isAdmin || access.can("human_resources", "manage"))) redirect("/");
  const [t, departments, positions] = await Promise.all([getT(), listDepartments(), listPositions()]);
  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("pos.title")} backHref="/hr/employees">
      <PositionsAdmin
        departments={departments.map((d) => ({ id: d.id, name: d.name, nameAr: d.nameAr }))}
        positions={positions.map((p) => ({
          id: p.id,
          departmentId: p.departmentId,
          title: p.title,
          titleAr: p.titleAr,
          grade: p.grade,
          description: p.description,
          descriptionAr: p.descriptionAr,
        }))}
      />
    </AppShell>
  );
}
