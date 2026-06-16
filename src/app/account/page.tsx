import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { NotificationToggle } from "@/components/NotificationToggle";

export default async function AccountPage() {
  const access = await requireUser();
  const t = await getT();
  const u = access.user;

  return (
    <AppShell access={access} moduleKey="account" pageTitle={t("account.title")}>
      <div className="max-w-2xl space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div><span className="text-muted">{t("account.name")}: </span><span className="text-ink">{u.name}</span></div>
            <div><span className="text-muted">{t("account.email")}: </span><span className="text-ink">{u.email}</span></div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink">{t("notify.title")}</h2>
          <p className="mb-4 mt-1 text-sm text-muted">{t("notify.desc")}</p>
          <NotificationToggle />
        </div>
      </div>
    </AppShell>
  );
}
