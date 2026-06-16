import { requireAdmin } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import {
  CAPABILITY_MODULES,
  capabilitiesForModule,
  resolveCapabilityLevel,
} from "@/lib/auth/capabilities";
import { getAccessPolicy } from "@/lib/auth/access-policy-service";
import { PermissionsEditor } from "./PermissionsEditor";

export default async function PermissionsPage() {
  const access = await requireAdmin();
  const [t, overrides] = await Promise.all([getT(), getAccessPolicy()]);

  const modules = CAPABILITY_MODULES.map((key) => ({
    key,
    name: t(`module.${key}.name`),
    capabilities: capabilitiesForModule(key).map((c) => ({
      key: c.key,
      label: t(c.labelKey),
      level: resolveCapabilityLevel(overrides, key, c.key),
      defaultLevel: c.defaultLevel,
    })),
  }));

  return (
    <AppShell access={access} moduleKey="settings" pageTitle={t("perm.title")} backHref="/settings">
      <div className="max-w-3xl space-y-6">
        <p className="text-sm text-muted">{t("perm.intro")}</p>
        {modules.map((m) => (
          <PermissionsEditor key={m.key} module={m} />
        ))}
      </div>
    </AppShell>
  );
}
