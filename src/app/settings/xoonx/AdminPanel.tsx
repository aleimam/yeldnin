"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { TrashIcon } from "@/components/icons/TrashIcon";
import { Combobox } from "@/components/Combobox";
import {
  createCategoryAction,
  renameCategoryAction,
  setCategoryEnabledAction,
  deleteCategoryAction,
  setFxRatesAction,
  setStaffSharesAction,
  type Result,
} from "./actions";

interface Cat { id: number; name: string; enabled: boolean }
interface Staff { id: number; name: string; sharePct: number }
interface Person { id: number; name: string }
interface Props {
  month: string;
  currencies: string[];
  fx: Record<string, number>;
  categories: Cat[];
  staff: Staff[];          // current profit partners
  candidates: Person[];    // XOONX-permissioned users not yet partners
}

const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Each row owns its name state (keyed by id in the list), so a freshly-added or
// renamed category renders correctly without a full reload.
function CategoryRow({ cat, onResult }: { cat: Cat; onResult: (r: Result) => void }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(cat.name);
  const act = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      onResult(r);
      if (r.ok) router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <input className="input max-w-xs" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => act(() => renameCategoryAction(cat.id, name))} disabled={pending} className="btn-secondary">{t("common.save")}</button>
      <label className="ms-2 flex items-center gap-1 text-sm text-muted">
        <input type="checkbox" checked={cat.enabled} onChange={(e) => act(() => setCategoryEnabledAction(cat.id, e.target.checked))} /> {t("xadm.enabled")}
      </label>
      <button
        onClick={() => { if (confirm(t("xadm.deleteCatConfirm"))) act(() => deleteCategoryAction(cat.id)); }}
        disabled={pending}
        className="ms-auto text-red-600 hover:text-red-700 disabled:opacity-50"
        title={t("common.delete")}
        aria-label={t("common.delete")}
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AdminPanel({ month, currencies, fx, categories, staff, candidates }: Props) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const flash = (res: Result) => {
    if (res.ok) { setMsg(t("customers.saved")); setErr(null); router.refresh(); }
    else { setErr(res.error); setMsg(null); }
  };

  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(currencies.map((c) => [c, fx[c] != null ? String(fx[c]) : ""])),
  );
  const saveFx = () =>
    start(async () => flash(await setFxRatesAction(month, currencies.map((c) => ({ currency: c, rate: Number(rates[c]) || 0 })))));

  const [newCat, setNewCat] = useState("");
  const addCat = () => start(async () => { const r = await createCategoryAction(newCat); if (r.ok) setNewCat(""); flash(r); });

  // Profit partners are managed as an explicit list: add from the candidate pool,
  // remove with the trash button, then Save persists exactly what's shown.
  const [partners, setPartners] = useState<Staff[]>(staff);
  const [shares, setShares] = useState<Record<number, string>>(Object.fromEntries(staff.map((s) => [s.id, String(s.sharePct)])));
  const total = partners.reduce((sum, s) => sum + (Number(shares[s.id]) || 0), 0);
  // The add-picker offers everyone known (initial partners + server candidates)
  // who isn't currently in the list, so removing then re-adding works in-session.
  const addable = useMemo(() => {
    const known = new Map<number, Person>();
    for (const p of [...staff, ...candidates]) known.set(p.id, { id: p.id, name: p.name });
    for (const p of partners) known.delete(p.id);
    return [...known.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, candidates, partners]);
  const addPartner = (id: number) => {
    const person = addable.find((p) => p.id === id);
    if (!person) return;
    setPartners((p) => [...p, { ...person, sharePct: 0 }]);
    setShares((s) => ({ ...s, [id]: s[id] ?? "0" }));
  };
  const removePartner = (id: number) => setPartners((p) => p.filter((x) => x.id !== id));
  const saveShares = () => start(async () => flash(await setStaffSharesAction(partners.map((s) => ({ userId: s.id, sharePct: Number(shares[s.id]) || 0 })))));

  return (
    <div className="max-w-3xl space-y-6">
      {(msg || err) && (
        <div className={`alert ${err ? "alert-error" : "alert-success"}`}>{err ?? msg}</div>
      )}

      {/* FX rates — one Save for all currencies */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink">{t("xadm.fx")}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push(`/settings/xoonx?m=${shiftMonth(month, -1)}`)} className="btn-secondary px-2 py-1"><span className="rtl-flip">‹</span></button>
            <span className="min-w-24 text-center text-sm font-medium text-ink">{month}</span>
            <button onClick={() => router.push(`/settings/xoonx?m=${shiftMonth(month, 1)}`)} className="btn-secondary px-2 py-1"><span className="rtl-flip">›</span></button>
          </div>
        </div>
        <p className="mb-3 text-xs text-muted">{t("xadm.fxHint")}</p>
        <div className="space-y-2">
          {currencies.map((cur) => (
            <div key={cur} className="flex items-center gap-3">
              <span className="w-12 font-mono text-sm text-ink">{cur}</span>
              <input type="number" step="any" min={0} className="input max-w-40" value={rates[cur]} onChange={(e) => setRates((p) => ({ ...p, [cur]: e.target.value }))} placeholder="EGP" />
            </div>
          ))}
        </div>
        <button onClick={saveFx} disabled={pending} className="btn-primary mt-3">{t("common.save")}</button>
      </div>

      {/* Expense categories */}
      <div className="card p-5">
        <h2 className="mb-3 font-semibold text-ink">{t("xadm.categories")}</h2>
        <div className="mb-3 flex gap-2">
          <input className="input max-w-xs" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t("xadm.newCategory")} />
          <button onClick={addCat} disabled={pending || !newCat.trim()} className="btn-primary">+ {t("common.add")}</button>
        </div>
        <div className="divide-y divide-line">
          {categories.map((c) => <CategoryRow key={c.id} cat={c} onResult={flash} />)}
          {categories.length === 0 && <p className="py-2 text-sm text-muted">{t("xadm.noCategories")}</p>}
        </div>
      </div>

      {/* Staff profit-shares — explicit partner roster */}
      <div className="card p-5">
        <h2 className="mb-1 font-semibold text-ink">{t("xadm.shares")}</h2>
        <p className="mb-3 text-xs text-muted">{t("xadm.sharesHint")}</p>
        {partners.length === 0 ? (
          <p className="mb-3 text-sm text-muted">{t("xadm.noPartners")}</p>
        ) : (
          <div className="space-y-2">
            {partners.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-ink">{s.name}</span>
                <input type="number" step="any" min={0} className="input max-w-28 text-end" value={shares[s.id] ?? ""} onChange={(e) => setShares((p) => ({ ...p, [s.id]: e.target.value }))} />
                <span className="text-muted">%</span>
                <button
                  onClick={() => removePartner(s.id)}
                  className="text-red-600 hover:text-red-700"
                  title={t("xadm.removePartner")}
                  aria-label={t("xadm.removePartner")}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {addable.length > 0 && (
          <div className="mt-3 max-w-xs">
            <Combobox
              placeholder={t("xadm.addPartner")}
              value=""
              onChange={(v) => addPartner(Number(v))}
              options={addable.map((p) => ({ value: String(p.id), label: p.name }))}
            />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className={`text-sm font-medium ${Math.round(total) === 100 || total === 0 ? "text-muted" : "text-red-600"}`}>
            {t("xadm.total")}: {Math.round(total * 100) / 100}%
          </span>
          <button onClick={saveShares} disabled={pending} className="btn-primary">{t("common.save")}</button>
        </div>
      </div>
    </div>
  );
}
