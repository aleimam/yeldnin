"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { formatBizDate } from "@/lib/format/dates";
import { createExpenseAction, updateExpenseAction, deleteExpenseAction } from "./actions";

interface Row {
  id: number;
  date: string;
  category: string;
  categoryId: number | null;
  amount: number;
  note: string | null;
  requestId: number | null;
}
interface Props {
  month: string;
  canManage: boolean;
  closed: boolean;
  petty: number;
  monthTotal: number;
  categories: { id: number; name: string }[];
  requests: { id: number; uid: string | null; product: string }[];
  expenses: Row[];
}

const egp = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function ExpenseManager({ month, canManage, closed, petty, monthTotal, categories, requests, expenses }: Props) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const blank = { categoryId: "", amount: "", note: "", requestId: "" };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const goMonth = (m: string) => router.push(`/xoonx/expenses?m=${m}`);

  function reset() {
    setEditId(null);
    setF(blank);
    setError(null);
  }
  function submit() {
    setError(null);
    const input = {
      categoryId: f.categoryId ? Number(f.categoryId) : null,
      amount: Number(f.amount) || 0,
      note: f.note || null,
      requestId: f.requestId ? Number(f.requestId) : null,
    };
    start(async () => {
      const res = editId ? await updateExpenseAction(editId, input) : await createExpenseAction(input);
      if (res.ok) {
        reset();
        router.refresh();
      } else setError(res.error);
    });
  }
  function edit(r: Row) {
    setEditId(r.id);
    setError(null);
    setF({ categoryId: r.categoryId ? String(r.categoryId) : "", amount: String(r.amount), note: r.note ?? "", requestId: r.requestId ? String(r.requestId) : "" });
  }
  function remove(id: number) {
    if (!confirm(t("xexp.deleteConfirm"))) return;
    start(async () => {
      const res = await deleteExpenseAction(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Month nav + balances */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => goMonth(shiftMonth(month, -1))} className="btn-secondary px-2 py-1">‹</button>
          <span className="min-w-28 text-center font-semibold text-ink">{month}</span>
          <button onClick={() => goMonth(shiftMonth(month, 1))} className="btn-secondary px-2 py-1">›</button>
        </div>
        <div className="flex gap-3">
          <div className="card px-4 py-2 text-sm">
            <div className="text-muted">{t("xexp.petty")}</div>
            <div className="text-lg font-bold text-ink">{egp(petty)} <span className="text-xs font-normal text-muted">EGP</span></div>
          </div>
          <div className="card px-4 py-2 text-sm">
            <div className="text-muted">{t("xexp.monthTotal")}</div>
            <div className="text-lg font-bold text-ink">{egp(monthTotal)} <span className="text-xs font-normal text-muted">EGP</span></div>
          </div>
        </div>
      </div>

      {closed && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30">{t("xexp.closedMonth")}</div>}

      {/* Record / edit form */}
      {canManage && !closed && (
        <div className="card space-y-3 p-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label">{t("xexp.category")}</label>
              <select className="input" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t("xexp.amount")}</label>
              <input type="number" step="any" min={0} className="input" value={f.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">{t("xexp.note")}</label>
              <input className="input" value={f.note} onChange={(e) => set("note", e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <label className="label">{t("xexp.request")}</label>
              <select className="input" value={f.requestId} onChange={(e) => set("requestId", e.target.value)}>
                <option value="">—</option>
                {requests.map((r) => <option key={r.id} value={r.id}>{r.uid ?? `#${r.id}`} · {r.product}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={submit} disabled={pending} className="btn-primary">{pending ? "…" : editId ? t("common.save") : t("xexp.record")}</button>
              {editId && <button onClick={reset} disabled={pending} className="btn-secondary">{t("common.cancel")}</button>}
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("xexp.date")}</th>
              <th className="th">{t("xexp.category")}</th>
              <th className="th text-end">{t("xexp.amount")}</th>
              <th className="th">{t("xexp.note")}</th>
              {canManage && !closed && <th className="th"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {expenses.map((r) => (
              <tr key={r.id} className="hover:bg-canvas/60">
                <td className="td whitespace-nowrap text-xs text-muted">{formatBizDate(r.date)}</td>
                <td className="td">{r.category}</td>
                <td className="td text-end font-medium text-ink">{egp(r.amount)}</td>
                <td className="td text-muted">{r.note ?? "—"}</td>
                {canManage && !closed && (
                  <td className="td whitespace-nowrap text-end">
                    <button onClick={() => edit(r)} disabled={pending} className="text-sm text-brand hover:underline">{t("common.edit")}</button>
                    <button onClick={() => remove(r.id)} disabled={pending} className="ms-3 text-sm text-red-600 hover:underline">{t("common.delete")}</button>
                  </td>
                )}
              </tr>
            ))}
            {expenses.length === 0 && <tr><td className="td text-muted" colSpan={5}>{t("xexp.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
