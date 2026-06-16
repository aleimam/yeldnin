"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { markShipmentPhotosSentAction } from "./actions";

export function ShipmentPhotosButton({ id, status }: { id: number; status: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (status !== "OFFICE") return <span className="text-sm text-muted">{t(`shipmentstatus.${status}`)}</span>;
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
