"use client";
import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import { AutoTextarea } from "@/components/AutoTextarea";
import { sendNotificationAction } from "./actions";

type Mode = "all" | "users" | "teams";

export function SendForm({
  users,
  teams,
}: {
  users: { id: number; name: string }[];
  teams: { key: string; name: string }[];
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [type, setType] = useState("info");
  const [image, setImage] = useState<UploadedPhoto | null>(null);
  const [mode, setMode] = useState<Mode>("all");
  const [userIds, setUserIds] = useState<Set<number>>(new Set());
  const [teamKeys, setTeamKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const toggleUser = (id: number) => setUserIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTeam = (k: string) => setTeamKeys((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  function submit() {
    setError(""); setMsg("");
    const target = mode === "all" ? { all: true } : mode === "users" ? { userIds: [...userIds] } : { teamKeys: [...teamKeys] };
    start(async () => {
      const res = await sendNotificationAction({ title, body, link: link || null, imageAssetId: image?.id ?? null, type, target });
      if (res.ok) {
        setMsg(`${t("notifysend.sent")} (${res.count})`);
        setTitle(""); setBody(""); setLink(""); setImage(null); setUserIds(new Set()); setTeamKeys(new Set());
      } else setError(res.error);
    });
  }

  const modeBtn = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 rounded-lg border px-2 py-1 text-sm ${mode === m ? "border-brand bg-brand text-brand-fg" : "border-line text-ink hover:bg-canvas"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="card max-w-2xl space-y-4 p-6">
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>}

      <div><label className="label">{t("notifysend.msgTitle")}</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><label className="label">{t("notifysend.msgBody")}</label><AutoTextarea value={body} onChange={(e) => setBody(e.target.value)} /></div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">{t("notifysend.link")}</label><input className="input" placeholder="/requests" value={link} onChange={(e) => setLink(e.target.value)} /></div>
        <div>
          <label className="label">{t("notifysend.type")}</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="info">{t("notifysend.type.info")}</option>
            <option value="warning">{t("notifysend.type.warning")}</option>
            <option value="success">{t("notifysend.type.success")}</option>
          </select>
        </div>
      </div>

      <div><label className="label">{t("notifysend.image")}</label><PhotoUpload photos={image ? [image] : []} onChange={(n) => setImage(n.at(-1) ?? null)} /></div>

      <div>
        <label className="label">{t("notifysend.recipients")}</label>
        <div className="flex gap-2">
          {modeBtn("all", t("notifysend.toAll"))}
          {modeBtn("users", t("notifysend.toUsers"))}
          {modeBtn("teams", t("notifysend.toTeams"))}
        </div>
        {mode === "users" && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-line p-2">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 py-0.5 text-sm text-ink">
                <input type="checkbox" checked={userIds.has(u.id)} onChange={() => toggleUser(u.id)} /> {u.name}
              </label>
            ))}
          </div>
        )}
        {mode === "teams" && (
          <div className="mt-2 flex flex-wrap gap-3 rounded-lg border border-line p-2">
            {teams.map((tm) => (
              <label key={tm.key} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={teamKeys.has(tm.key)} onChange={() => toggleTeam(tm.key)} /> {tm.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : t("notifysend.send")}</button>
    </div>
  );
}
