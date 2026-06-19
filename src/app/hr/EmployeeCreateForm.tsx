"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { createEmployeeAction } from "./actions";

type Field = "name" | "nameAr" | "email" | "username" | "password" | "tier" | "primaryPhone" | "lineManagerId" | "hiringDate";

export function EmployeeCreateForm({ managers }: { managers: { id: number; label: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState<Record<Field, string>>({ name: "", nameAr: "", email: "", username: "", password: "", tier: "MEMBER", primaryPhone: "", lineManagerId: "", hiringDate: "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: Field) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = () => {
    setErr(null);
    start(async () => {
      const res = await createEmployeeAction({
        name: f.name,
        nameAr: f.nameAr || null,
        email: f.email,
        username: f.username || null,
        password: f.password,
        tier: f.tier,
        primaryPhone: f.primaryPhone || null,
        lineManagerId: f.lineManagerId ? Number(f.lineManagerId) : null,
        hiringDate: f.hiringDate || null,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.push(`/hr/employees/${res.id}`);
    });
  };

  return (
    <div className="card space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">{t("hr.name")} *</span><input className="input" value={f.name} onChange={set("name")} /></label>
        <label className="block"><span className="label">{t("hr.nameAr")}</span><input className="input" dir="rtl" value={f.nameAr} onChange={set("nameAr")} /></label>
        <label className="block"><span className="label">{t("hr.email")} *</span><input className="input" type="email" value={f.email} onChange={set("email")} /></label>
        <label className="block"><span className="label">{t("hr.username")}</span><input className="input" value={f.username} onChange={set("username")} /></label>
        <label className="block"><span className="label">{t("hr.password")} *</span><input className="input" value={f.password} onChange={set("password")} /></label>
        <label className="block"><span className="label">{t("hr.tier")}</span>
          <select className="input" value={f.tier} onChange={set("tier")}>
            <option value="MEMBER">{t("tier.MEMBER")}</option>
            <option value="ADMIN">{t("tier.ADMIN")}</option>
            <option value="SUPER_ADMIN">{t("tier.SUPER_ADMIN")}</option>
          </select>
        </label>
        <label className="block"><span className="label">{t("hr.phone")}</span><input className="input" value={f.primaryPhone} onChange={set("primaryPhone")} /></label>
        <label className="block"><span className="label">{t("hr.manager")}</span>
          <select className="input" value={f.lineManagerId} onChange={set("lineManagerId")}>
            <option value="">—</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">{t("hr.hiringDate")}</span><input className="input" type="date" value={f.hiringDate} onChange={set("hiringDate")} /></label>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="button" className="btn-primary" disabled={pending || !f.name || !f.email || !f.password} onClick={submit}>{t("hr.createEmployee")}</button>
    </div>
  );
}
