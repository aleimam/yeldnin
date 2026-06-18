import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { getUserDetail, listTeams } from "@/lib/users/users-service";
import { displayName } from "@/lib/users/users-logic";
import { MAIN_MODULES, ADMIN_MODULES } from "@/lib/modules";
import type { Level } from "@/lib/auth/access-logic";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import { AccessForm } from "./AccessForm";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireCapability("user_access", "manageUsers");
  const { id } = await params;
  const userId = Number(id);
  const [user, teams, t, locale] = await Promise.all([
    getUserDetail(userId),
    listTeams(),
    getT(),
    getLocale(),
  ]);
  if (!user) notFound();

  const isAdminTier = user.tier === "ADMIN" || user.tier === "SUPER_ADMIN";
  const initialLevels: Record<string, Level> = {};
  for (const p of user.modulePerms) initialLevels[p.moduleKey] = p.level as Level;

  return (
    <AppShell access={access} moduleKey="user_access" pageTitle={displayName(user, locale)} backHref="/users">
      <div className="max-w-2xl space-y-6">
        <ProfileForm
          user={{
            id: user.id,
            name: user.name,
            nameAr: user.nameAr ?? "",
            uid: user.uid ?? "",
            fullName: user.fullName ?? "",
            fullNameAr: user.fullNameAr ?? "",
            username: user.username ?? "",
            email: user.email,
            tier: user.tier,
            active: user.active,
            primaryPhone: user.primaryPhone ?? "",
            secondaryPhone: user.secondaryPhone ?? "",
            yeldnPhone: user.yeldnPhone ?? "",
            avatarUrl: user.avatarUrl ?? null,
          }}
        />
        <PasswordForm userId={user.id} />
        <AccessForm
          userId={user.id}
          teams={teams.map((tm) => ({ key: tm.key, name: tm.name }))}
          modules={[...MAIN_MODULES, ...ADMIN_MODULES].map((m) => ({
            key: m.key,
            icon: m.icon,
            name: t(`module.${m.key}.name`),
          }))}
          initialTeamKeys={user.teamMembers.map((tm) => tm.team.key)}
          initialLevels={initialLevels}
          isAdminTier={isAdminTier}
        />
      </div>
    </AppShell>
  );
}
