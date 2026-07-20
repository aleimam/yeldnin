import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getCourierWithLogin } from "@/lib/couriers/couriers-service";
import { CourierForm } from "../CourierForm";
import { CourierLoginPanel } from "./CourierLoginPanel";

export default async function EditCourierPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireCapability("couriers", "operate");
  const { id } = await params;
  const c = await getCourierWithLogin(Number(id));
  if (!c) notFound();
  const t = await getT();
  // Minting/resetting a login is a MANAGE action; a plain OPERATE editor sees
  // the panel read-only (whether a login exists) but can't change it.
  const canManageLogin = access.canModule("couriers", "MANAGE");
  return (
    <AppShell access={access} moduleKey="couriers" pageTitle={c.name} backHref="/couriers">
      <div className="space-y-4">
        <CourierForm mode="edit" initial={{ id: c.id, name: c.name, contact: c.contact ?? "", active: c.active }} />
        <CourierLoginPanel
          courierId={c.id}
          canManage={canManageLogin}
          login={c.user ? { phone: c.user.username ?? "", active: c.user.active, locked: !!c.user.lockedUntil && c.user.lockedUntil > new Date() } : null}
        />
      </div>
    </AppShell>
  );
}
