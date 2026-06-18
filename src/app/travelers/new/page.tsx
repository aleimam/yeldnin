import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listTravelersForPicker } from "@/lib/travelers/travelers-service";
import { TravelerForm } from "../TravelerForm";

export default async function NewTravelerPage() {
  const access = await requireCapability("logistics", "operate");
  if (access.hidesTripTraveler) redirect("/");
  const [t, travelers] = await Promise.all([getT(), listTravelersForPicker()]);
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("travelers.new")} backHref="/travelers">
      <TravelerForm
        mode="create"
        travelers={travelers}
        initial={{
          name: "", contact: "", notes: "", referenceTravelerId: "",
          blacklisted: false, staticAddress: false, carriesMaleSupport: false,
          allowedProductTypes: [], active: true, photos: [],
        }}
      />
    </AppShell>
  );
}
