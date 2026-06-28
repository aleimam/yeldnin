import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { transferEndpoints } from "@/lib/transfers/transfer-service";
import { listCarriersForPicker } from "@/lib/carriers/carriers-service";
import { TransferForm } from "../TransferForm";

export default async function NewTransferPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const access = await requireCapability("logistics", "operate");
  const sp = await searchParams;
  const [t, endpoints, carriers] = await Promise.all([getT(), transferEndpoints(), listCarriersForPicker()]);
  return (
    <AppShell access={access} moduleKey="logistics" pageTitle={t("transfers.new")} backHref="/transfers">
      <div className="max-w-2xl">
        <TransferForm endpoints={endpoints} carriers={carriers.map((c) => ({ id: c.id, name: c.name }))} initialFrom={sp.from ?? ""} />
      </div>
    </AppShell>
  );
}
