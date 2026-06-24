"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { DateField } from "@/components/DateField";
import { createHolidayAction, archiveHolidayAction, setHolidayBonusAction } from "../attendance-actions";

interface Holiday {
  id: number;
  title: string;
  type: string;
  dateLabel: string;
  bonuses: { teamId: number; amountPerDay: number }[];
}
interface Team {
  id: number;
  key: string;
}

export function HolidayManager({ holidays, teams }: { holidays: Holiday[]; teams: Team[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("VACATION");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const add = () => {
    setErr(null);
    start(async () => {
      const r = await createHolidayAction({ title, type, startDate: from, endDate: to });
      if (!r.ok) { setErr(r.error); return; }
      setTitle(""); setFrom(""); setTo("");
      router.refresh();
    });
  };

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-semibold text-ink">{t("leave.holidays")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input sm:col-span-2" placeholder={t("leave.holidayTitle")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="EID_DAYS">{t("leave.eidDays")}</option>
          <option value="EID_VACATION">{t("leave.eidVacation")}</option>
          <option value="VACATION">{t("leave.vacation")}</option>
        </select>
        <span className="hidden sm:block" />
        <label className="block"><span className="label">{t("leave.from")}</span><DateField className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="block"><span className="label">{t("leave.to")}</span><DateField className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="button" className="btn-primary" disabled={pending || !title || !from || !to} onClick={add}>{t("leave.addHoliday")}</button>

      <div className="space-y-2 border-t border-line pt-3">
        {holidays.map((h) => <HolidayRow key={h.id} h={h} teams={teams} pending={pending} start={start} router={router} />)}
        {holidays.length === 0 && <p className="text-sm text-muted">—</p>}
      </div>
    </div>
  );
}

function HolidayRow({ h, teams, pending, start, router }: { h: Holiday; teams: Team[]; pending: boolean; start: (fn: () => void) => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
  const [team, setTeam] = useState("");
  const [amount, setAmount] = useState("");
  const teamName = (id: number) => teams.find((tm) => tm.id === id)?.key ?? `#${id}`;

  const setBonus = () => start(async () => { await setHolidayBonusAction(h.id, Number(team), Number(amount) || 0); setAmount(""); router.refresh(); });
  const archive = () => { if (!window.confirm(t("leave.archiveConfirm"))) return; start(async () => { await archiveHolidayAction(h.id); router.refresh(); }); };

  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <div className="flex items-center justify-between">
        <div><span className="font-medium text-ink">{h.title}</span> <span className="text-xs text-muted">· {t(h.type === "EID_DAYS" ? "leave.eidDays" : h.type === "EID_VACATION" ? "leave.eidVacation" : "leave.vacation")} · {h.dateLabel}</span></div>
        <button type="button" className="text-xs text-red-600 hover:underline" disabled={pending} onClick={archive}>{t("leave.archive")}</button>
      </div>
      {h.bonuses.length > 0 && <div className="mt-1 text-xs text-muted">{t("leave.workBonus")}: {h.bonuses.map((b) => `${teamName(b.teamId)} ${b.amountPerDay}`).join(" · ")}</div>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select className="input h-8 w-40 py-0 text-xs" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">{t("leave.team")}</option>
          {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.key}</option>)}
        </select>
        <input className="input h-8 w-28 py-0 text-xs" type="number" placeholder={t("leave.bonusPerDay")} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending || !team} onClick={setBonus}>{t("hr.save")}</button>
      </div>
    </div>
  );
}
