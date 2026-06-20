import Link from "next/link";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";

export default async function HrPage() {
  const access = await requireModule("human_resources", "VIEW");
  const t = await getT();
  const cards = [
    { href: "/hr/employees", icon: "👥", label: t("hr.employees"), ready: true },
    { href: "/hr/hierarchy", icon: "🪜", label: t("hr.hierarchy"), ready: true },
    { href: "/hr/attendance", icon: "🗓️", label: t("hr.attendance"), ready: true },
    { href: "/hr/my-leave", icon: "🌴", label: t("leave.myLeave"), ready: true },
    { href: "/hr/my-salary", icon: "💵", label: t("salary.mySalary"), ready: true },
    { href: "/hr/payroll", icon: "💰", label: t("pay.title"), ready: true },
    { href: "/hr/analytics", icon: "📊", label: t("an.title"), ready: true },
    { href: "/hr/setup", icon: "⚙️", label: t("hr.setup"), ready: true },
  ];
  return (
    <AppShell access={access} moduleKey="human_resources" pageTitle={t("module.human_resources.name")}>
      <div className="space-y-6">
        <div className="rounded-xl bg-brand/10 p-6 text-center">
          <p className="text-lg font-semibold text-ink">{t("hr.slogan")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) =>
            c.ready ? (
              <Link key={c.label} href={c.href} className="card flex items-center gap-3 p-5 hover:bg-canvas/60">
                <span className="text-2xl">{c.icon}</span>
                <span className="font-medium text-ink">{c.label}</span>
              </Link>
            ) : (
              <div key={c.label} className="card flex items-center justify-between gap-3 p-5 opacity-60">
                <span className="flex items-center gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <span className="font-medium text-ink">{c.label}</span>
                </span>
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t("hr.soon")}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </AppShell>
  );
}
