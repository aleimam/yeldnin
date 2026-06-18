import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listUsers, listTeams } from "@/lib/users/users-service";
import { SendForm } from "./SendForm";

export default async function SendNotificationPage() {
  const access = await requireCapability("settings", "sendNotifications");
  const [t, users, teams] = await Promise.all([getT(), listUsers(), listTeams()]);
  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("notifysend.title")} backHref="/settings">
      <SendForm
        users={users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }))}
        teams={teams.map((tm) => ({ key: tm.key, name: tm.name }))}
      />
    </AppShell>
  );
}
