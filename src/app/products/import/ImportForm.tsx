"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { importProductsAction } from "./actions";

export function ImportForm({ scopes }: { scopes: string[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scope, setScope] = useState(scopes[0] ?? "VEEEY");
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("scope", scope);
    setError(null);
    setResult(null);
    start(async () => {
      const res = await importProductsAction(fd);
      if (res.ok) {
        setResult({ created: res.created, skipped: res.skipped });
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-lg space-y-4 p-6">
      {error && <div className="alert alert-error">{error}</div>}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {t("pimport.created")}: {result.created} · {t("pimport.skipped")}: {result.skipped}
        </div>
      )}
      <p className="text-sm text-muted">{t("pimport.hint")}</p>
      <div>
        <label className="label">{t("requests.scope")}</label>
        <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
          {scopes.map((s) => <option key={s} value={s}>{t(`scope.${s}`)}</option>)}
        </select>
      </div>
      <div>
        <label className="label">{t("pimport.file")}</label>
        <input type="file" name="file" accept=".xlsx,.xls" className="input" required />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">{pending ? "…" : t("pimport.import")}</button>
    </form>
  );
}
