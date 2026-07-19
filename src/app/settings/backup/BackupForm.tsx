"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { formatBizDate } from "@/lib/format/dates";
import type { BackupConfigView } from "@/lib/backup/backup-service";
import { BACKUP_PROTOCOLS, defaultPortFor, type BackupProtocol } from "@/lib/backup/backup-logic";
import { saveBackupAction, testBackupAction, runBackupNowAction } from "./actions";

const FREQUENCIES = ["OFF", "HOURLY", "DAILY", "WEEKLY", "MONTHLY"] as const;

export function BackupForm({ initial }: { initial: BackupConfigView }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"" | "save" | "test" | "run">("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);

  const [f, setF] = useState({
    enabled: initial.enabled,
    protocol: initial.protocol,
    host: initial.host ?? "",
    port: String(initial.port),
    username: initial.username ?? "",
    password: "",
    remotePath: initial.remotePath,
    secure: initial.secure,
    includeDb: initial.includeDb,
    includeUploads: initial.includeUploads,
    frequency: initial.frequency,
    hourUtc: initial.hourUtc,
    weekday: initial.weekday,
    dayOfMonth: initial.dayOfMonth,
    retentionKeep: String(initial.retentionKeep),
    notifyOnFailure: initial.notifyOnFailure,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  /** Switching protocol re-defaults the port (FTPS 21 / SFTP 22) so the field is
   *  never left pointing at the previous protocol's port. */
  const setProtocol = (p: string) =>
    setF((s) => ({ ...s, protocol: p, port: String(defaultPortFor(p as BackupProtocol)) }));

  const payload = () => ({
    enabled: f.enabled,
    protocol: f.protocol,
    host: f.host,
    port: Number(f.port) || 21,
    username: f.username,
    password: f.password, // empty = keep the stored one
    remotePath: f.remotePath,
    secure: f.secure,
    includeDb: f.includeDb,
    includeUploads: f.includeUploads,
    frequency: f.frequency,
    hourUtc: f.hourUtc,
    weekday: f.weekday,
    dayOfMonth: f.dayOfMonth,
    retentionKeep: Number(f.retentionKeep) || 0,
    notifyOnFailure: f.notifyOnFailure,
  });

  const save = () =>
    start(async () => {
      setBusy("save");
      setMsg(null);
      const r = await saveBackupAction(payload());
      setMsg(r.ok ? { tone: "ok", text: t("backup.saved") } : { tone: "err", text: r.error ?? t("common.error") });
      if (r.ok) { set("password", ""); router.refresh(); }
      setBusy("");
    });

  const test = () =>
    start(async () => {
      setBusy("test");
      setMsg({ tone: "info", text: t("backup.testing") });
      await saveBackupAction(payload()); // persist current fields so the test uses them
      const r = await testBackupAction();
      setMsg({ tone: r.ok ? "ok" : "err", text: r.message });
      if (r.ok) set("password", "");
      router.refresh();
      setBusy("");
    });

  const runNow = () =>
    start(async () => {
      if (!confirm(t("backup.runConfirm"))) return;
      setBusy("run");
      setMsg({ tone: "info", text: t("backup.running") });
      const r = await runBackupNowAction();
      setMsg(r.ok ? { tone: "ok", text: t("backup.ranOk", { file: r.fileName ?? "" }) } : { tone: "err", text: r.error ?? t("common.error") });
      router.refresh();
      setBusy("");
    });

  const alertClass = msg?.tone === "ok" ? "alert-success" : msg?.tone === "err" ? "alert-error" : "alert-info";
  const showHour = f.frequency === "DAILY" || f.frequency === "WEEKLY" || f.frequency === "MONTHLY";

  return (
    <div className="space-y-6">
      {msg && <div className={`alert ${alertClass}`}>{msg.text}</div>}

      {/* Enable */}
      <div className="card p-5">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={f.enabled} onChange={(e) => set("enabled", e.target.checked)} />
          <span className="font-medium text-ink">{t("backup.enabled")}</span>
        </label>
        <p className="mt-1 text-xs text-muted">{t("backup.enabledHint")}</p>
      </div>

      {/* Destination */}
      <div className="card space-y-4 p-5">
        <h2 className="font-semibold text-ink">{t("backup.destination")}</h2>
        <p className="text-xs text-muted">{t("backup.destinationHint")}</p>
        <div>
          <label className="label">{t("backup.protocol")}</label>
          <select className="input sm:max-w-xs" value={f.protocol} onChange={(e) => setProtocol(e.target.value)}>
            {BACKUP_PROTOCOLS.map((p) => <option key={p} value={p}>{t(`backup.proto.${p}`)}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">{t("backup.protocolHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">{t("backup.host")}</label>
            <input className="input" value={f.host} onChange={(e) => set("host", e.target.value)} placeholder="ftp.example.com" />
          </div>
          <div>
            <label className="label">{t("backup.port")}</label>
            <input className="input" inputMode="numeric" value={f.port} onChange={(e) => set("port", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("backup.username")}</label>
            <input className="input" value={f.username} onChange={(e) => set("username", e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label className="label">{t("backup.password")}</label>
            <input className="input" type="password" value={f.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" placeholder={initial.hasPassword ? t("backup.passwordKeep") : ""} />
          </div>
          <div>
            <label className="label">{t("backup.remotePath")}</label>
            <input className="input" value={f.remotePath} onChange={(e) => set("remotePath", e.target.value)} placeholder="/backups" />
          </div>
        </div>
        {/* TLS is an FTPS concept — SFTP is always encrypted by SSH. */}
        {f.protocol === "FTPS" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.secure} onChange={(e) => set("secure", e.target.checked)} />
            <span className="text-ink">{t("backup.secure")}</span>
          </label>
        )}
      </div>

      {/* Contents */}
      <div className="card space-y-3 p-5">
        <h2 className="font-semibold text-ink">{t("backup.contents")}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.includeDb} onChange={(e) => set("includeDb", e.target.checked)} />
          <span className="text-ink">{t("backup.includeDb")}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.includeUploads} onChange={(e) => set("includeUploads", e.target.checked)} />
          <span className="text-ink">{t("backup.includeUploads")}</span>
        </label>
      </div>

      {/* Schedule */}
      <div className="card space-y-4 p-5">
        <h2 className="font-semibold text-ink">{t("backup.schedule")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">{t("backup.frequency")}</label>
            <select className="input" value={f.frequency} onChange={(e) => set("frequency", e.target.value)}>
              {FREQUENCIES.map((x) => <option key={x} value={x}>{t(`backup.freq.${x}`)}</option>)}
            </select>
          </div>
          {showHour && (
            <div>
              <label className="label">{t("backup.hour")}</label>
              <select className="input" value={f.hourUtc} onChange={(e) => set("hourUtc", Number(e.target.value))}>
                {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00 UTC</option>)}
              </select>
            </div>
          )}
          {f.frequency === "WEEKLY" && (
            <div>
              <label className="label">{t("backup.weekday")}</label>
              <select className="input" value={f.weekday} onChange={(e) => set("weekday", Number(e.target.value))}>
                {Array.from({ length: 7 }).map((_, d) => <option key={d} value={d}>{t(`backup.dow.${d}`)}</option>)}
              </select>
            </div>
          )}
          {f.frequency === "MONTHLY" && (
            <div>
              <label className="label">{t("backup.dayOfMonth")}</label>
              <select className="input" value={f.dayOfMonth} onChange={(e) => set("dayOfMonth", Number(e.target.value))}>
                {Array.from({ length: 28 }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("backup.retention")}</label>
            <input className="input" inputMode="numeric" value={f.retentionKeep} onChange={(e) => set("retentionKeep", e.target.value)} />
            <p className="mt-1 text-xs text-muted">{t("backup.retentionHint")}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.notifyOnFailure} onChange={(e) => set("notifyOnFailure", e.target.checked)} />
          <span className="text-ink">{t("backup.notifyOnFailure")}</span>
        </label>
      </div>

      {/* Status + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">{busy === "save" ? t("common.saving") : t("common.save")}</button>
        <button type="button" onClick={test} disabled={pending} className="btn-secondary">{busy === "test" ? t("backup.testing") : t("backup.test")}</button>
        <button type="button" onClick={runNow} disabled={pending} className="btn-secondary">{busy === "run" ? t("backup.running") : t("backup.runNow")}</button>
        <div className="ms-auto text-xs text-muted">
          {initial.lastRunAt && <span className="block">{t("backup.lastRun", { when: formatBizDate(initial.lastRunAt) })}</span>}
          {initial.lastTestAt && <span className="block">{t("backup.lastTest", { when: formatBizDate(initial.lastTestAt), result: initial.lastTestOk ? t("backup.ok") : t("backup.failed") })}</span>}
        </div>
      </div>
    </div>
  );
}
