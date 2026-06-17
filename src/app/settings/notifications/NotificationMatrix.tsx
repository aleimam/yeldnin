"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { splitCsv, type NotifyRule } from "@/lib/notify/notify-logic";
import { saveNotifyRulesAction } from "./actions";

type EventMeta = { key: string; orderCreator: boolean; statuses: boolean };

export function NotificationMatrix({
  initial,
  events,
  modules,
  statuses,
}: {
  initial: NotifyRule[];
  events: EventMeta[];
  modules: { key: string; label: string }[];
  statuses: { value: string; label: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rules, setRules] = useState<NotifyRule[]>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const metaOf = (key: string) => events.find((e) => e.key === key) ?? { key, orderCreator: false, statuses: false };
  function update(i: number, patch: Partial<NotifyRule>) {
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSaved(false);
  }
  function toggleCsv(csv: string, value: string): string {
    const set = new Set(splitCsv(csv));
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return [...set].join(",");
  }

  function save() {
    setError("");
    setSaved(false);
    start(async () => {
      const res = await saveNotifyRulesAction(rules);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted">{t("notifyrules.intro")}</p>
      {rules.map((r, i) => {
        const meta = metaOf(r.event);
        const mods = new Set(splitCsv(r.moduleKeys));
        const sts = new Set(splitCsv(r.statuses));
        return (
          <div key={r.event} className="card space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">{t(`notifyevent.${r.event}`)}</h3>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={r.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
                {t("notifyrules.enabled")}
              </label>
            </div>
            {r.enabled && (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-ink">
                    <input type="checkbox" checked={r.notifyAdmins} onChange={(e) => update(i, { notifyAdmins: e.target.checked })} />
                    {t("notifyrules.admins")}
                  </label>
                  {meta.orderCreator && (
                    <label className="flex items-center gap-2 text-ink">
                      <input type="checkbox" checked={r.notifyOrderCreator} onChange={(e) => update(i, { notifyOrderCreator: e.target.checked })} />
                      {t("notifyrules.orderCreator")}
                    </label>
                  )}
                </div>
                <div>
                  <p className="label mb-1">{t("notifyrules.modules")}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {modules.map((m) => (
                      <label key={m.key} className="flex items-center gap-1.5 text-ink">
                        <input type="checkbox" checked={mods.has(m.key)} onChange={() => update(i, { moduleKeys: toggleCsv(r.moduleKeys, m.key) })} />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>
                {meta.statuses && (
                  <div>
                    <p className="label mb-1">{t("notifyrules.statuses")}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {statuses.map((s) => (
                        <label key={s.value} className="flex items-center gap-1.5 text-ink">
                          <input type="checkbox" checked={sts.has(s.value)} onChange={() => update(i, { statuses: toggleCsv(r.statuses, s.value) })} />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">{t("notifyrules.saved")}</p>}
      <button onClick={save} disabled={pending} className="btn-primary">{pending ? "…" : t("common.save")}</button>
    </div>
  );
}
