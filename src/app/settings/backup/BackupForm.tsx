"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { formatBizDate } from "@/lib/format/dates";
import type { BackupConfigView, BackupTierView } from "@/lib/backup/backup-service";
import { BACKUP_PROTOCOLS, TIER_CONTENTS, defaultPortFor, type BackupProtocol } from "@/lib/backup/backup-logic";
import { saveBackupAction, testBackupAction, runBackupNowAction, runTierNowAction } from "./actions";

const FREQUENCIES = ["OFF", "HOURLY", "DAILY", "WEEKLY", "MONTHLY"] as const;

export function BackupForm({ initial, initialTiers }: { initial: BackupConfigView; initialTiers: BackupTierView[] }) {
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
    notifyOnFailure: initial.notifyOnFailure,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const [tiers, setTiers] = useState(initialTiers);
  const setTier = <K extends keyof BackupTierView>(key: string, k: K, v: BackupTierView[K]) =>
    setTiers((list) => list.map((x) => (x.key === key ? { ...x, [k]: v } : x)));

  /**
   * Switching protocol re-defaults the port (FTPS 21 / SFTP 22) — but ONLY when
   * the field still holds the previous protocol's default, i.e. it looks
   * untouched. A deliberately-set port must survive: a Hetzner Storage Box
   * serves SFTP on 23, and blindly resetting it to 22 silently breaks backups.
   */
  const setProtocol = (p: string) =>
    setF((s) => ({
      ...s,
      protocol: p,
      port:
        Number(s.port) === defaultPortFor(s.protocol as BackupProtocol)
          ? String(defaultPortFor(p as BackupProtocol))
          : s.port,
    }));

  const payload = () => ({
    enabled: f.enabled,
    protocol: f.protocol,
    host: f.host,
    port: Number(f.port) || 21,
    username: f.username,
    password: f.password, // empty = keep the stored one
    remotePath: f.remotePath,
    secure: f.secure,
    // Superseded by each tier's `contents`; sent so the stored row stays sane.
    includeDb: true,
    includeUploads: true,
    frequency: "HOURLY",
    tiered: true,
    notifyOnFailure: f.notifyOnFailure,
  });

  const tierPayload = () =>
    tiers.map((x) => ({
      key: x.key,
      enabled: x.enabled,
      frequency: x.frequency,
      everyN: Number(x.everyN) || 1,
      hourUtc: x.hourUtc,
      weekday: x.weekday,
      dayOfMonth: x.dayOfMonth,
      contents: x.contents,
      remotePath: x.remotePath,
      keepLast: Number(x.keepLast) || 0,
    }));

  const save = () =>
    start(async () => {
      setBusy("save");
      setMsg(null);
      const r = await saveBackupAction(payload(), tierPayload());
      setMsg(r.ok ? { tone: "ok", text: t("backup.saved") } : { tone: "err", text: r.error ?? t("common.error") });
      if (r.ok) { set("password", ""); router.refresh(); }
      setBusy("");
    });

  const test = () =>
    start(async () => {
      setBusy("test");
      setMsg({ tone: "info", text: t("backup.testing") });
      await saveBackupAction(payload(), tierPayload()); // persist current fields so the test uses them
      const r = await testBackupAction();
      setMsg({ tone: r.ok ? "ok" : "err", text: r.message });
      if (r.ok) set("password", "");
      router.refresh();
      setBusy("");
    });

  /** Run one level on demand — saves first so the run uses what is on screen. */
  const runTier = (key: string) =>
    start(async () => {
      setBusy("run");
      setMsg({ tone: "info", text: t("backup.running") });
      await saveBackupAction(payload(), tierPayload());
      const r = await runTierNowAction(key);
      setMsg(r.ok
        ? { tone: "ok", text: t("backup.ranOk", { file: r.fileName ?? "" }) }
        : { tone: "err", text: r.error ?? t("common.error") });
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
            <p className="mt-1 text-xs text-muted">{t("backup.remotePathHint")}</p>
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

      {/* Levels */}
      <div className="card space-y-5 p-5">
        <div>
          <h2 className="font-semibold text-ink">{t("backup.levels")}</h2>
          <p className="mt-1 text-xs text-muted">{t("backup.levelsHint")}</p>
        </div>

        {tiers.map((x) => {
          const showHour = x.frequency === "DAILY" || x.frequency === "WEEKLY" || x.frequency === "MONTHLY";
          return (
            <div key={x.key} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={x.enabled} onChange={(e) => setTier(x.key, "enabled", e.target.checked)} />
                  <span className="font-medium text-ink">{t(`backup.tier.${x.key}`)}</span>
                </label>
                <div className="flex items-center gap-3">
                  {x.lastRunAt && (
                    <span className="text-xs text-muted">{t("backup.lastRun", { when: formatBizDate(x.lastRunAt) })}</span>
                  )}
                  <button type="button" onClick={() => runTier(x.key)} disabled={pending} className="btn-sm btn-secondary">
                    {t("backup.runTier")}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-4">
                <div>
                  <label className="label">{t("backup.frequency")}</label>
                  <select className="input" value={x.frequency} onChange={(e) => setTier(x.key, "frequency", e.target.value)}>
                    {FREQUENCIES.map((v) => <option key={v} value={v}>{t(`backup.freq.${v}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t("backup.everyN")}</label>
                  <input className="input" inputMode="numeric" value={String(x.everyN)}
                    onChange={(e) => setTier(x.key, "everyN", Number(e.target.value) || 1)} />
                  <p className="mt-1 text-xs text-muted">{t("backup.everyNHint")}</p>
                </div>
                {showHour && (
                  <div>
                    <label className="label">{t("backup.hour")}</label>
                    <select className="input" value={x.hourUtc} onChange={(e) => setTier(x.key, "hourUtc", Number(e.target.value))}>
                      {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00 UTC</option>)}
                    </select>
                  </div>
                )}
                {x.frequency === "WEEKLY" && (
                  <div>
                    <label className="label">{t("backup.weekday")}</label>
                    <select className="input" value={x.weekday} onChange={(e) => setTier(x.key, "weekday", Number(e.target.value))}>
                      {Array.from({ length: 7 }).map((_, d) => <option key={d} value={d}>{t(`backup.dow.${d}`)}</option>)}
                    </select>
                  </div>
                )}
                {x.frequency === "MONTHLY" && (
                  <div>
                    <label className="label">{t("backup.dayOfMonth")}</label>
                    <select className="input" value={x.dayOfMonth} onChange={(e) => setTier(x.key, "dayOfMonth", Number(e.target.value))}>
                      {Array.from({ length: 28 }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">{t("backup.tierContents")}</label>
                  <select className="input" value={x.contents} onChange={(e) => setTier(x.key, "contents", e.target.value)}>
                    {TIER_CONTENTS.map((c) => <option key={c} value={c}>{t(`backup.contents.${c}`)}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">{t("backup.tierFolder")}</label>
                  <input className="input" value={x.remotePath} onChange={(e) => setTier(x.key, "remotePath", e.target.value)} />
                </div>
                <div>
                  <label className="label">{t("backup.keepLast")}</label>
                  <input className="input" inputMode="numeric" value={String(x.keepLast)}
                    onChange={(e) => setTier(x.key, "keepLast", Number(e.target.value) || 0)} />
                  <p className="mt-1 text-xs text-muted">{t("backup.keepLastHint")}</p>
                </div>
              </div>
            </div>
          );
        })}

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
