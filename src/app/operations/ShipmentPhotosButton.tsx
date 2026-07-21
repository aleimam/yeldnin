"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { markShipmentPhotosSentAction, markShipmentOnWebsiteAction } from "./actions";

/**
 * The shipment's forward step. OFFICE → PHOTOS_SENT → WEBSITE; the last one is
 * the hand-over: items become stock and Veeey is told what arrived so its Sales
 * can approve it into sellable lots. `missingExpiry` blocks that step — handing
 * over units with no expiry would give Sales nothing to review.
 */
export function ShipmentPhotosButton({ id, status, missingExpiry = 0 }: { id: number; status: string; missingExpiry?: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  if (status === "OFFICE") {
    return (
      <button
        onClick={() => start(async () => { await markShipmentPhotosSentAction(id); router.refresh(); })}
        disabled={pending}
        className="btn-primary px-3 py-1.5 text-sm"
      >
        {pending ? "…" : t("shipments.markPhotosSent")}
      </button>
    );
  }

  if (status === "PHOTOS_SENT") {
    const blocked = missingExpiry > 0;
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => start(async () => { await markShipmentOnWebsiteAction(id); router.refresh(); })}
          disabled={pending || blocked}
          className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "…" : t("shipments.markOnWebsite")}
        </button>
        {blocked && <span className="text-xs text-amber-700">{t("shipments.blockedMissingExpiry").replace("{n}", String(missingExpiry))}</span>}
      </div>
    );
  }

  return <span className="text-sm text-muted">{t(`shipmentstatus.${status}`)}</span>;
}
