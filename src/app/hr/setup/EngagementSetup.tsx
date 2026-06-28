"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import {
  createCategoryAction, updateCategoryAction, archiveCategoryAction,
  createTemplateAction, archiveTemplateAction,
  createCriterionAction, updateCriterionAction, archiveCriterionAction,
} from "../engagement-actions";

interface Category { id: number; name: string; nameAr: string | null }
interface Criterion { id: number; name: string; nameAr: string | null; bonusAmount: number }
interface Template { id: number; name: string; nameAr: string | null; description: string | null; category: { id: number; name: string } | null; criteria: Criterion[] }

export function EngagementSetup({ categories, templates }: { categories: Category[]; templates: Template[] }) {
  return (
    <div className="space-y-6">
      <CategoriesSection categories={categories} />
      <TemplatesSection templates={templates} categories={categories} />
    </div>
  );
}

function CategoriesSection({ categories }: { categories: Category[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ name: "", nameAr: "" });
  const [err, setErr] = useState<string | null>(null);
  const add = () => {
    setErr(null);
    start(async () => {
      const r = await createCategoryAction({ name: f.name, nameAr: f.nameAr || null });
      if (!r.ok) { setErr(r.error); return; }
      setF({ name: "", nameAr: "" });
      router.refresh();
    });
  };
  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("eng.categories")}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder={t("comp.name")} value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />
        <input className="input" dir="rtl" placeholder={t("comp.nameAr")} value={f.nameAr} onChange={(e) => setF((s) => ({ ...s, nameAr: e.target.value }))} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending || !f.name.trim()} onClick={add}>{t("eng.addCategory")}</button>
      <div className="space-y-2">
        {categories.map((c) => <CategoryRow key={c.id} c={c} pending={pending} start={start} router={router} />)}
        {categories.length === 0 && <p className="text-sm text-muted">—</p>}
      </div>
    </div>
  );
}

function CategoryRow({ c, pending, start, router }: { c: Category; pending: boolean; start: (fn: () => void) => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
  const [name, setName] = useState(c.name);
  const [nameAr, setNameAr] = useState(c.nameAr ?? "");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
      <input className="input h-8 w-40 py-0" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input h-8 w-40 py-0" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
      <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending || !name.trim()} onClick={() => start(async () => { await updateCategoryAction(c.id, { name, nameAr: nameAr || null }); router.refresh(); })}>{t("hr.save")}</button>
      <button type="button" className="ms-auto text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(async () => { await archiveCategoryAction(c.id); router.refresh(); })}>{t("leave.archive")}</button>
    </div>
  );
}

function TemplatesSection({ templates, categories }: { templates: Template[]; categories: Category[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ name: "", nameAr: "", categoryId: "", description: "" });
  const [err, setErr] = useState<string | null>(null);
  const add = () => {
    setErr(null);
    start(async () => {
      const r = await createTemplateAction({ name: f.name, nameAr: f.nameAr || null, categoryId: f.categoryId ? Number(f.categoryId) : null, description: f.description || null });
      if (!r.ok) { setErr(r.error); return; }
      setF({ name: "", nameAr: "", categoryId: "", description: "" });
      router.refresh();
    });
  };
  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold text-ink">{t("eng.templates")}</h2>
      <p className="text-sm text-muted">{t("eng.templatesDesc")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input" placeholder={t("comp.name")} value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />
        <input className="input" dir="rtl" placeholder={t("comp.nameAr")} value={f.nameAr} onChange={(e) => setF((s) => ({ ...s, nameAr: e.target.value }))} />
        <select className="input" value={f.categoryId} onChange={(e) => setF((s) => ({ ...s, categoryId: e.target.value }))}>
          <option value="">{t("eng.noCategory")}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" placeholder={t("eng.description")} value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending || !f.name.trim()} onClick={add}>{t("eng.addTemplate")}</button>
      <div className="space-y-3">
        {templates.map((tpl) => <TemplateCard key={tpl.id} tpl={tpl} pending={pending} start={start} router={router} />)}
        {templates.length === 0 && <p className="text-sm text-muted">—</p>}
      </div>
    </div>
  );
}

function TemplateCard({ tpl, pending, start, router }: { tpl: Template; pending: boolean; start: (fn: () => void) => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
  const [cf, setCf] = useState({ name: "", nameAr: "", bonusAmount: "" });
  const addCriterion = () => start(async () => {
    if (!cf.name.trim()) return;
    await createCriterionAction(tpl.id, { name: cf.name, nameAr: cf.nameAr || null, bonusAmount: Number(cf.bonusAmount) || 0 });
    setCf({ name: "", nameAr: "", bonusAmount: "" });
    router.refresh();
  });
  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-ink">{tpl.name}{tpl.category ? <span className="ms-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{tpl.category.name}</span> : null}</span>
        <button type="button" className="text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(async () => { await archiveTemplateAction(tpl.id); router.refresh(); })}>{t("leave.archive")}</button>
      </div>
      {tpl.description && <p className="mt-1 text-xs text-muted">{tpl.description}</p>}
      <div className="mt-2 space-y-1.5">
        {tpl.criteria.map((c) => <CriterionRow key={c.id} c={c} pending={pending} start={start} router={router} />)}
        {tpl.criteria.length === 0 && <p className="text-xs text-muted">{t("eng.noCriteria")}</p>}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-line/60 pt-2">
        <input className="input h-8 w-36 py-0 text-xs" placeholder={t("eng.criterion")} value={cf.name} onChange={(e) => setCf((s) => ({ ...s, name: e.target.value }))} />
        <input className="input h-8 w-28 py-0 text-xs" dir="rtl" placeholder={t("comp.nameAr")} value={cf.nameAr} onChange={(e) => setCf((s) => ({ ...s, nameAr: e.target.value }))} />
        <input className="input h-8 w-24 py-0 text-xs" type="number" step="0.01" placeholder={t("eng.bonus")} value={cf.bonusAmount} onChange={(e) => setCf((s) => ({ ...s, bonusAmount: e.target.value }))} />
        <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending || !cf.name.trim()} onClick={addCriterion}>{t("eng.addCriterion")}</button>
      </div>
    </div>
  );
}

function CriterionRow({ c, pending, start, router }: { c: Criterion; pending: boolean; start: (fn: () => void) => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
  const [name, setName] = useState(c.name);
  const [nameAr, setNameAr] = useState(c.nameAr ?? "");
  const [bonus, setBonus] = useState(String(c.bonusAmount));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="input h-8 w-36 py-0 text-xs" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input h-8 w-28 py-0 text-xs" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
      <input className="input h-8 w-24 py-0 text-xs" type="number" step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)} />
      <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={pending || !name.trim()} onClick={() => start(async () => { await updateCriterionAction(c.id, { name, nameAr: nameAr || null, bonusAmount: Number(bonus) || 0 }); router.refresh(); })}>{t("hr.save")}</button>
      <button type="button" className="ms-auto text-xs text-red-600 hover:underline" disabled={pending} onClick={() => start(async () => { await archiveCriterionAction(c.id); router.refresh(); })}>{t("leave.archive")}</button>
    </div>
  );
}
