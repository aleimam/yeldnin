import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { parseTypes } from "@/lib/travelers/travelers-logic";
import { getTraveler, listTravelersForPicker } from "@/lib/travelers/travelers-service";
import { TravelerForm } from "../../TravelerForm";

export default async function EditTravelerPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireCapability("logistics", "operate");
  const { id } = await params;
  const tr = await getTraveler(Number(id));
  if (!tr) notFound();
  const [t, travelers] = await Promise.all([getT(), listTravelersForPicker(tr.id)]);
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={`${t("products.edit")} · ${tr.name}`} backHref={`/travelers/${id}`}>
      <TravelerForm
        mode="edit"
        travelers={travelers}
        initial={{
          id: tr.id,
          name: tr.name,
          contact: tr.contact ?? "",
          notes: tr.notes ?? "",
          referenceTravelerId: tr.referenceTravelerId ? String(tr.referenceTravelerId) : "",
          blacklisted: tr.blacklisted,
          staticAddress: tr.staticAddress,
          carriesMaleSupport: tr.carriesMaleSupport,
          allowedProductTypes: parseTypes(tr.allowedProductTypes),
          active: tr.active,
          photos: tr.photos.map((ph) => ({ id: ph.assetId, url: assetUrl(ph.assetId)! })),
        }}
      />
    </AppShell>
  );
}
