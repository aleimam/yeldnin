import Link from "next/link";
import type { ReactNode } from "react";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listEmployees } from "@/lib/hr/hr-service";

export default async function HierarchyPage() {
  const access = await requireModule("human_resources", "VIEW");
  const [t, rows] = await Promise.all([getT(), listEmployees()]);

  const byManager = new Map<number | null, typeof rows>();
  for (const e of rows) {
    const k = e.lineManagerId ?? null;
    const arr = byManager.get(k) ?? [];
    arr.push(e);
    byManager.set(k, arr);
  }

  const renderNode = (e: (typeof rows)[number], depth: number): ReactNode => {
    if (depth > 30) return null; // defensive against any data loop
    const children = byManager.get(e.id) ?? [];
    return (
      <li key={e.id}>
        <div className="flex items-center gap-2 py-1" style={{ paddingInlineStart: `${depth * 1.25}rem` }}>
          {depth > 0 && <span className="text-muted">└</span>}
          <Link href={`/hr/employees/${e.id}`} className="text-brand hover:underline">{e.user?.name ?? `#${e.id}`}</Link>
          {children.length > 0 && <span className="text-xs text-muted">({children.length})</span>}
        </div>
        {children.length > 0 && <ul>{children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  };

  const roots = byManager.get(null) ?? [];
  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("hr.hierarchy")} backHref="/hr">
      <div className="card p-5">
        {roots.length === 0 ? <p className="text-sm text-muted">—</p> : <ul className="text-sm">{roots.map((r) => renderNode(r, 0))}</ul>}
      </div>
    </AppShell>
  );
}
