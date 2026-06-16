import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listAudit } from "@/lib/audit";
import { userNameMap } from "@/lib/expenses/expenses-service";
import { AuditTable } from "../AuditTable";

export default async function AuditModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const access = await requireModule("audit_log", "VIEW");
  const { module } = await params;
  const [t, rows] = await Promise.all([getT(), listAudit({ moduleKey: module, take: 300 })]);
  const names = await userNameMap(rows.map((r) => r.userId));
  const title = module ? t(`module.${module}.name`) : t("audit.all");
  return (
    <AppShell access={access} moduleKey="audit_log" pageTitle={title}>
      <AuditTable rows={rows} names={names} t={t} />
    </AppShell>
  );
}
