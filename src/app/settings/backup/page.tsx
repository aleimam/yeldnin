import { requireAdmin } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { formatBizDate } from "@/lib/format/dates";
import { formatBytes } from "@/lib/backup/backup-logic";
import { backupView } from "@/lib/backup/backup-service";
import { BackupForm } from "./BackupForm";

const STATUS_TONE: Record<string, string> = {
  SUCCESS: "bg-green-500/15 text-green-600",
  FAILED: "bg-red-500/15 text-red-600",
  RUNNING: "bg-amber-500/15 text-amber-600",
};

export default async function BackupSettingsPage() {
  const access = await requireAdmin();
  const [t, data] = await Promise.all([getT(), backupView()]);

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("backup.title")} backHref="/settings">
      <div className="max-w-3xl space-y-6">
        <p className="text-sm text-muted">{t("backup.intro")}</p>
        <BackupForm initial={data.config} initialTiers={data.tiers} />

        <section>
          <h2 className="mb-2 font-semibold text-ink">{t("backup.history")}</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm" data-cards>
              <thead className="border-b border-line bg-canvas">
                <tr>
                  <th className="th">{t("backup.col.when")}</th>
                  <th className="th">{t("backup.col.level")}</th>
                  <th className="th">{t("backup.col.trigger")}</th>
                  <th className="th">{t("backup.col.contents")}</th>
                  <th className="th">{t("backup.col.size")}</th>
                  <th className="th">{t("backup.col.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.runs.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="td whitespace-nowrap text-muted" data-datecol data-label={t("backup.col.when")}>{formatBizDate(r.startedAt)}</td>
                    <td className="td text-muted" data-label={t("backup.col.level")}>{r.tierKey ? t(`backup.tier.${r.tierKey}`) : "—"}</td>
                    <td className="td text-muted" data-label={t("backup.col.trigger")}>{t(`backup.trigger.${r.trigger}`)}</td>
                    <td className="td text-muted" data-label={t("backup.col.contents")}>{r.contents || "—"}</td>
                    <td className="td text-muted" data-label={t("backup.col.size")}>{formatBytes(r.sizeBytes)}</td>
                    <td className="td" data-label={t("backup.col.status")}>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[r.status] ?? "bg-canvas text-muted"}`}>{t(`backup.status.${r.status}`)}</span>
                      {r.error && <span className="ms-1 block text-xs text-red-600">{r.error}</span>}
                    </td>
                  </tr>
                ))}
                {data.runs.length === 0 && <tr><td className="td text-muted" colSpan={6}>{t("backup.noRuns")}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
