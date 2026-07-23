import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listPositions } from "@/lib/hr/positions-service";
import { PositionsAdmin } from "./PositionsAdmin";

// Admin-managed job titles (Positions). Departments are managed as Teams under
// Users → Departments. HR-manage (or admin).
export default async function PositionsPage() {
  const access = await requireUser();
  if (!(access.isAdmin || access.can("human_resources", "manage"))) redirect("/");
  const [t, positions] = await Promise.all([getT(), listPositions()]);
  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("pos.title")} backHref="/hr/employees">
      <PositionsAdmin
        positions={positions.map((p) => ({
          id: p.id,
          title: p.title,
          titleAr: p.titleAr,
          grade: p.grade,
          gradeLevel: p.gradeLevel,
          description: p.description,
          descriptionAr: p.descriptionAr,
        }))}
      />
    </AppShell>
  );
}
