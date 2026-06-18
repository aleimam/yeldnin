import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getTrip } from "@/lib/trips/trip-service";
import { listTravelersForPicker } from "@/lib/travelers/travelers-service";
import { listCountryOptions } from "@/lib/countries/countries-service";
import { TripForm, type TripFormInitial } from "../../TripForm";

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireUser();
  if (access.hidesTripTraveler) redirect("/");
  const { id } = await params;
  const trip = await getTrip(Number(id));
  if (!trip) notFound();
  // Creator or admin only (no status lock).
  if (!access.isAdmin && trip.createdById !== access.user.id) redirect(`/trips/${trip.id}`);

  const [t, travelers, countries] = await Promise.all([getT(), listTravelersForPicker(), listCountryOptions()]);
  const initial: TripFormInitial = {
    id: trip.id,
    travelerId: trip.travelerId,
    country: trip.country,
    maxWeight: trip.maxWeight,
    dealPricePerKg: trip.dealPricePerKg,
    lastReceivingDate: ymd(trip.lastReceivingDate),
    deliveryDateInEgypt: ymd(trip.deliveryDateInEgypt),
    notes: trip.notes ?? "",
    handlingFee: trip.handlingFee != null ? String(trip.handlingFee) : "",
    handlingFeeCurrency: trip.handlingFeeCurrency ?? "",
    allowedProductTypes: trip.allowedProductTypes ? trip.allowedProductTypes.split(",").map((s) => s.trim()).filter(Boolean) : [],
  };

  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={`${t("common.edit")} · ${trip.uid ?? `#${trip.id}`}`} backHref={`/trips/${trip.id}`}>
      <TripForm travelers={travelers} countries={countries} trip={initial} />
    </AppShell>
  );
}
