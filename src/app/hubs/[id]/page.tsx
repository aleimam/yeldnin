import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { getHub } from "@/lib/hubs/hubs-service";
import { listCountryOptions } from "@/lib/countries/countries-service";
import { HubForm } from "../HubForm";

export default async function EditHubPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireCapability("logistics", "operate");
  const { id } = await params;
  const h = await getHub(Number(id));
  if (!h) notFound();
  const [t, countries] = await Promise.all([getT(), listCountryOptions()]);
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={h.name} backHref="/hubs">
      <HubForm
        mode="edit"
        countries={countries}
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
