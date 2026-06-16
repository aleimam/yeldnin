import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { getHub } from "@/lib/hubs/hubs-service";
import { HubForm } from "../HubForm";

export default async function EditHubPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("logistics", "OPERATE");
  const { id } = await params;
  const h = await getHub(Number(id));
  if (!h) notFound();
  const t = await getT();
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={h.name} backHref="/hubs">
      <HubForm
        mode="edit"
        initial={{
          id: h.id,
          name: h.name,
          country: h.country,
          notes: h.notes ?? "",
          active: h.active,
          photos: h.photos.map((ph) => ({ id: ph.assetId, url: assetUrl(ph.assetId)! })),
        }}
      />
    </AppShell>
  );
}
