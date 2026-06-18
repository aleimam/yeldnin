import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { canAccessCs, canEvaluateCalls, canManageCs, isRep } from "@/lib/cs/cs-logic";

export default async function CsQualityHub() {
  const access = await requireUser();
  if (!canAccessCs(access)) redirect("/");
  const t = await getT();
  const manage = canManageCs(access);
  const evaluate = canEvaluateCalls(access);
  const rep = isRep(access);

  const cards = [
    evaluate && { href: "/cs-quality/evaluate/call", icon: "📞", label: t("cs.evaluateCall") },
    manage && { href: "/cs-quality/evaluate/performance", icon: "📅", label: t("cs.evaluatePerformance") },
    evaluate && { href: "/cs-quality/submitted", icon: "📤", label: t("cs.submitted") },
    manage && { href: "/cs-quality/review", icon: "✅", label: t("cs.review") },
    rep && { href: "/cs-quality/mine", icon: "📋", label: t("cs.myEvaluations") },
    !manage && { href: "/cs-quality/criteria", icon: "📖", label: t("cs.criteriaTitle") },
    manage && { href: "/cs-quality/analytics", icon: "📈", label: t("cs.analytics") },
    manage && { href: "/cs-quality/bonus", icon: "🎁", label: t("cs.bonus") },
    manage && { href: "/cs-quality/questions", icon: "📝", label: t("cs.questionPool") },
    manage && { href: "/cs-quality/types", icon: "🏷️", label: t("cs.types") },
    manage && { href: "/cs-quality/values", icon: "🔢", label: t("cs.answerValues") },
  ].filter(Boolean) as { href: string; icon: string; label: string }[];

  return (
    <AppShell access={access} moduleKey="cs_quality" pageTitle={t("module.cs_quality.name")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card group flex items-center gap-4 p-5 transition hover:shadow-md hover:ring-1 hover:ring-brand/30"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-canvas text-2xl">{c.icon}</span>
            <span className="font-semibold text-ink group-hover:text-brand">{c.label}</span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
