import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { formatBizDate } from "@/lib/format/dates";
import { listInbox } from "@/lib/notify/notify-message-service";
import { NotificationList } from "./NotificationList";

export default async function NotificationsPage() {
  const access = await requireUser();
  const [t, rows] = await Promise.all([getT(), listInbox(access.user.id)]);
  return (
    <AppShell access={access} moduleKey="notifications" pageTitle={t("common.notifications")}>
      <NotificationList
        items={rows.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          link: r.link,
          imageUrl: assetUrl(r.imageAssetId),
          type: r.type,
          date: formatBizDate(r.createdAt),
          read: !!r.readAt,
        }))}
      />
    </AppShell>
  );
}
