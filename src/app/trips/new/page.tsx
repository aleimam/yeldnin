import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listTravelersForPicker } from "@/lib/travelers/travelers-service";
import { TripForm } from "../TripForm";

export default async function NewTripPage() {
  const access = await requireModule("logistics", "OPERATE");
  const [t, travelers] = await Promise.all([getT(), listTravelersForPicker()]);
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("trip.new")} backHref="/trips">
      <TripForm travelers={travelers} />
    </AppShell>
  );
}
