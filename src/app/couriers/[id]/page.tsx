import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getCourier } from "@/lib/couriers/couriers-service";
import { CourierForm } from "../CourierForm";

export default async function EditCourierPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("couriers", "OPERATE");
  const { id } = await params;
  const c = await getCourier(Number(id));
  if (!c) notFound();
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="couriers" pageTitle={c.name} backHref="/couriers">
      <CourierForm mode="edit" initial={{ id: c.id, name: c.name, contact: c.contact ?? "", active: c.active }} />
    </AppShell>
  );
}
