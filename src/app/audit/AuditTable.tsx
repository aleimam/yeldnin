import type { TFunction } from "@/i18n";

export interface AuditRow {
  id: number;
  userId: number | null;
  moduleKey: string;
  action: string;
  entityType: string;
  entityId: string;
  meta: string | null;
  createdAt: Date;
}

export function AuditTable({
  rows,
  names,
  t,
}: {
  rows: AuditRow[];
  names: Map<number, string>;
  t: TFunction;
}) {
  const moduleLabel = (key: string) => (key ? t(`module.${key}.name`) : "—");

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-line bg-canvas">
          <tr>
            <th className="th">{t("audit.date")}</th>
            <th className="th">{t("audit.user")}</th>
            <th className="th">{t("audit.module")}</th>
            <th className="th">{t("audit.action")}</th>
            <th className="th">{t("audit.entity")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-canvas/60">
              <td className="td whitespace-nowrap text-muted">{new Date(r.createdAt).toLocaleString()}</td>
              <td className="td">{r.userId ? (names.get(r.userId) ?? `#${r.userId}`) : "—"}</td>
              <td className="td">{moduleLabel(r.moduleKey)}</td>
              <td className="td font-mono text-xs">{r.action}</td>
              <td className="td text-muted">
                {r.entityType}
                {r.entityId && r.entityId !== "batch" ? ` #${r.entityId}` : ""}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td className="td text-muted" colSpan={5}>{t("audit.empty")}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
