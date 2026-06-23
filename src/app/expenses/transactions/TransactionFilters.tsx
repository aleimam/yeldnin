"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT, useLocale } from "@/i18n/client";
import { categoryLabel } from "@/lib/expenses/category-label";

type Current = { q: string; type: string; flag: string; category: string; sort: string };

/** Filter / search / sort controls. Selects apply immediately; the search box
 *  applies on Enter. State lives in the URL so it survives reload + is shareable. */
export function TransactionFilters({
  categories,
  current,
}: {
  categories: { id: number; name: string; nameAr?: string | null }[];
  current: Current;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const arByName = Object.fromEntries(categories.filter((c) => c.nameAr).map((c) => [c.name, c.nameAr as string]));
  const [q, setQ] = useState(current.q);

  const push = (next: Partial<Current>) => {
    const merged = { ...current, q, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.type) params.set("type", merged.type);
    if (merged.flag) params.set("flag", merged.flag);
    if (merged.category) params.set("category", merged.category);
    if (merged.sort && merged.sort !== "accruing_desc") params.set("sort", merged.sort);
    const qs = params.toString();
    router.push(`/expenses/transactions${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <input
        className="input"
        placeholder={t("exp.searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") push({}); }}
      />
      <select className="input" value={current.type} onChange={(e) => push({ type: e.target.value })}>
        <option value="">{t("exp.allTypes")}</option>
        <option value="EXPENSE">{t("exp.expense")}</option>
        <option value="TRANSFER">{t("exp.transfer")}</option>
        <option value="REVENUE">{t("exp.revenue")}</option>
      </select>
      <select className="input" value={current.flag} onChange={(e) => push({ flag: e.target.value })}>
        <option value="">{t("exp.allFlags")}</option>
        <option value="ANY">{t("exp.flagged")}</option>
        <option value="RED">{t("exp.flagRed")}</option>
        <option value="YELLOW">{t("exp.flagYellow")}</option>
        <option value="NONE">{t("exp.unflagged")}</option>
      </select>
      <select className="input" value={current.category} onChange={(e) => push({ category: e.target.value })}>
        <option value="">{t("exp.allCategories")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{categoryLabel(t, c.name, locale, arByName)}</option>
        ))}
      </select>
      <select className="input" value={current.sort} onChange={(e) => push({ sort: e.target.value })}>
        <option value="accruing_desc">{t("exp.sortAccruingNew")}</option>
        <option value="accruing_asc">{t("exp.sortAccruingOld")}</option>
        <option value="registered_desc">{t("exp.sortRegisteredNew")}</option>
        <option value="amount_desc">{t("exp.sortAmountHigh")}</option>
        <option value="amount_asc">{t("exp.sortAmountLow")}</option>
      </select>
    </div>
  );
}
