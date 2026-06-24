import { cookies } from "next/headers";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listAuditPaged, auditModuleKeys } from "@/lib/audit";
import { userNameMap } from "@/lib/expenses/expenses-service";
import { pageWindow, PER_PAGE_COOKIE } from "@/lib/pagination";
import { Paginator } from "@/components/Paginator";
import { AuditTable } from "./AuditTable";
import { AuditFilters } from "./AuditFilters";

export default async function AuditAllPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireModule("audit_log", "VIEW");
  const sp = await searchParams;
  const cookiePerPage = Number((await cookies()).get(PER_PAGE_COOKIE)?.value) || undefined;
  const { page, perPage, skip, take } = pageWindow({ page: sp.page, perPage: sp.perPage, cookiePerPage });
  const [t, { rows, total }, modules] = await Promise.all([
    getT(),
    listAuditPaged({ moduleKey: sp.module, search: sp.q, skip, take }),
    auditModuleKeys(),
  ]);
  const names = await userNameMap(rows.map((r) => r.userId));
  return (
    <AppShell access={access} moduleKey="audit_log" pageTitle={t("audit.all")}>
      <AuditFilters basePath="/audit" current={{ q: sp.q ?? "", module: sp.module ?? "" }} modules={modules} />
      <AuditTable rows={rows} names={names} t={t} />
      <Paginator basePath="/audit" params={sp} page={page} perPage={perPage} total={total} />
    </AppShell>
  );
}
