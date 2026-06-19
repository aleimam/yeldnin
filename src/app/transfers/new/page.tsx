import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { transferEndpoints } from "@/lib/transfers/transfer-service";
import { listCouriersForPicker } from "@/lib/couriers/couriers-service";
import { TransferForm } from "../TransferForm";

export default async function NewTransferPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const access = await requireCapability("logistics", "operate");
  const sp = await searchParams;
  const [t, endpoints, couriers] = await Promise.all([getT(), transferEndpoints(), listCouriersForPicker()]);
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("transfers.new")} backHref="/transfers">
      <div className="max-w-2xl">
        <TransferForm endpoints={endpoints} couriers={couriers.map((c) => ({ id: c.id, name: c.name }))} initialFrom={sp.from ?? ""} />
      </div>
    </AppShell>
  );
}
