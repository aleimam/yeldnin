import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listTravelersForPicker } from "@/lib/travelers/travelers-service";
import { listCountryOptions } from "@/lib/countries/countries-service";
import { TripForm } from "../TripForm";

export default async function NewTripPage() {
  const access = await requireCapability("logistics", "operate");
  if (access.hidesTripTraveler) redirect("/");
  const [t, travelers, countries] = await Promise.all([getT(), listTravelersForPicker(), listCountryOptions()]);
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("trip.new")} backHref="/trips">
      <TripForm travelers={travelers} countries={countries} />
    </AppShell>
  );
}
