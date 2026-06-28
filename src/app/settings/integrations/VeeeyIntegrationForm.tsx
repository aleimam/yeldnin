"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { saveVeeeyConnectionAction, regenerateInboundKeyAction, testVeeeyConnectionAction } from "./actions";

interface View {
  name: string;
  enabled: boolean;
  baseUrl: string | null;
  hasOutboundSecret: boolean;
  inboundKeyHint: string | null;
  inboundKeyAt: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

export function VeeeyIntegrationForm({ initial }: { initial: View }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? "");
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(
    initial.lastTestOk == null ? null : { ok: initial.lastTestOk, message: initial.lastTestMessage ?? "" },
  );
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const save = () =>
    start(async () => {
      setSaveMsg(null);
      const r = await saveVeeeyConnectionAction({ baseUrl: baseUrl || null, outboundSecret: secret || null, enabled });
      if (!r.ok) { setSaveMsg({ ok: false, text: r.error }); return; }
      setSecret("");
      setSaveMsg({ ok: true, text: t("common.saved") });
      router.refresh();
    });

  const runTest = () =>
    start(async () => {
      const r = await testVeeeyConnectionAction();
      setTest(r);
      router.refresh();
    });

  const regen = () =>
    start(async () => {
      if (!window.confirm(t("integ.regenConfirm"))) return;
      const r = await regenerateInboundKeyAction();
      if (r.ok) { setNewKey(r.key); setCopied(false); router.refresh(); }
    });

  return (
    <div className="space-y-6">
      {/* Outbound: we call VEEEY */}
      <div className="card space-y-3 p-5">
        <h2 className="font-semibold text-ink">{t("integ.outbound")}</h2>
        <p className="text-sm text-muted">{t("integ.outboundDesc")}</p>
        <label className="block">
          <span className="label">{t("integ.baseUrl")}</span>
          <input className="input" placeholder="https://api.veeey.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">{t("integ.secret")}</span>
          <input
            className="input font-mono"
            type="password"
            autoComplete="off"
            placeholder={initial.hasOutboundSecret ? t("integ.secretSet") : t("integ.secretNone")}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <span className="mt-1 block text-xs text-muted">{t("integ.secretHint")}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t("integ.enabled")}
        </label>
        {saveMsg && <p className={`text-sm ${saveMsg.ok ? "text-green-600" : "text-red-600"}`}>{saveMsg.text}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending} onClick={save}>{t("hr.save")}</button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-sm" disabled={pending} onClick={runTest}>{pending ? "…" : t("integ.test")}</button>
          {test && (
            <span className={`text-sm ${test.ok ? "text-green-600" : "text-red-600"}`}>
              {test.ok ? "✓" : "✗"} {test.message}
            </span>
          )}
        </div>
        {initial.lastTestAt && <p className="text-xs text-muted">{t("integ.lastTest")}: {when(initial.lastTestAt)}</p>}
      </div>

      {/* Inbound: VEEEY calls us */}
      <div className="card space-y-3 p-5">
        <h2 className="font-semibold text-ink">{t("integ.inbound")}</h2>
        <p className="text-sm text-muted">{t("integ.inboundDesc")}</p>
        <div className="text-sm">
          <span className="text-muted">{t("integ.currentKey")}: </span>
          {initial.inboundKeyHint ? (
            <span className="font-mono text-ink">{initial.inboundKeyHint}</span>
          ) : (
            <span className="text-muted">{t("integ.noKey")}</span>
          )}
          {initial.inboundKeyAt && <span className="ms-2 text-xs text-muted">({when(initial.inboundKeyAt)})</span>}
        </div>
        {newKey && (
          <div className="alert alert-warning space-y-2">
            <p className="font-medium">{t("integ.newKeyOnce")}</p>
            <div className="flex items-center gap-2">
              <code className="block flex-1 overflow-x-auto rounded bg-canvas px-2 py-1 font-mono text-xs">{newKey}</code>
              <button type="button" className="btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(newKey); setCopied(true); }}>
                {copied ? t("integ.copied") : t("integ.copy")}
              </button>
            </div>
          </div>
        )}
        <button type="button" className="btn-secondary px-3 py-1.5 text-sm" disabled={pending} onClick={regen}>{t("integ.regen")}</button>
        <p className="text-xs text-muted">{t("integ.endpointSoon")}</p>
      </div>
    </div>
  );
}
