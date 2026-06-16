import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listAudit } from "@/lib/audit";
import { userNameMap } from "@/lib/expenses/expenses-service";
import { AuditTable } from "./AuditTable";

export default async function AuditAllPage() {
  const access = await requireModule("audit_log", "VIEW");
  const [t, rows] = await Promise.all([getT(), listAudit({ take: 300 })]);
  const names = await userNameMap(rows.map((r) => r.userId));
  return (
    <AppShell access={access} moduleKey="audit_log" pageTitle={t("audit.all")}>
      <AuditTable rows={rows} names={names} t={t} />
    </AppShell>
  );
}
