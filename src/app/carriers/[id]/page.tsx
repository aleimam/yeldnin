import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getCarrier } from "@/lib/carriers/carriers-service";
import { CarrierForm } from "../CarrierForm";

export default async function EditCarrierPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireCapability("logistics", "operate");
  const { id } = await params;
  const c = await getCarrier(Number(id));
  if (!c) notFound();
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={c.name} backHref="/carriers">
      <CarrierForm mode="edit" initial={{ id: c.id, name: c.name, contact: c.contact ?? "", active: c.active }} />
    </AppShell>
  );
}
