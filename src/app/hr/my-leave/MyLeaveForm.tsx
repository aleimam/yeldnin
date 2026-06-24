"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { DateField } from "@/components/DateField";
import { applyLeaveAction } from "../attendance-actions";

export function MyLeaveForm() {
  const t = useT();
  const router = useRouter();
  const [type, setType] = useState("ANNUAL");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startT] = useTransition();

  const submit = () => {
    setErr(null);
    setOk(false);
    startT(async () => {
      const res = await applyLeaveAction(type, start, end, reason || null);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOk(true);
      setStart("");
      setEnd("");
      setReason("");
      router.refresh();
    });
  };

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("leave.apply")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">{t("leave.type")}</span>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ANNUAL">{t("leave.annual")}</option>
            <option value="URGENT">{t("leave.urgent")}</option>
          </select>
        </label>
        <label className="block"><span className="label">{t("leave.reason")}</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <label className="block"><span className="label">{t("leave.from")}</span><DateField className="input" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="block"><span className="label">{t("leave.to")}</span><DateField className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      {err && <p className="text-sm text-red-600">{t(err)}</p>}
      {ok && <p className="text-sm text-green-600">{t("leave.submitted")}</p>}
      <button type="button" className="btn-primary" disabled={pending || !start || !end} onClick={submit}>{t("leave.apply")}</button>
    </div>
  );
}
