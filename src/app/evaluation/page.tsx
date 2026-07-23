import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";

export default async function EvaluationPage() {
  const access = await requireModule("evaluation", "VIEW");
  const t = await getT();
  const canManage = access.can("evaluation", "manage");

  const cards: { href: string; icon: string; label: string; ready: boolean; admin?: boolean }[] = [
    { href: "/evaluation", icon: "📝", label: t("eval.myReviews"), ready: false },
    { href: "/evaluation", icon: "📈", label: t("eval.myResults"), ready: false },
    { href: "/evaluation/criteria", icon: "📋", label: t("eval.criteria"), ready: true, admin: true },
    { href: "/evaluation", icon: "🗓️", label: t("eval.cycles"), ready: false, admin: true },
    { href: "/evaluation", icon: "📊", label: t("eval.analytics"), ready: false, admin: true },
    { href: "/evaluation", icon: "🤖", label: t("eval.aiFeedback"), ready: false, admin: true },
  ].filter((c) => !c.admin || canManage);

  return (
    <AppShell access={access} moduleKey="evaluation" pageTitle={t("module.evaluation.name")}>
      <div className="space-y-6">
        <div className="rounded-xl bg-brand/10 p-6 text-center">
          <p className="text-lg font-semibold text-ink">{t("eval.slogan")}</p>
          <p className="mt-1 text-sm text-muted">{t("eval.sloganHint")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) =>
            c.ready ? (
              <Link key={i} href={c.href} className="card flex items-center gap-3 p-5 hover:bg-canvas/60">
                <span className="text-2xl">{c.icon}</span>
                <span className="font-medium text-ink">{c.label}</span>
              </Link>
            ) : (
              <div key={i} className="card flex items-center justify-between gap-3 p-5 opacity-60">
                <span className="flex items-center gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <span className="font-medium text-ink">{c.label}</span>
                </span>
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("eval.soon")}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </AppShell>
  );
}
