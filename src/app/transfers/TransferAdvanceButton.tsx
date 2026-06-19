"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { nextTransferStatus } from "@/lib/transfers/transfer-logic";
import { advanceTransferAction } from "./actions";

export function TransferAdvanceButton({ id, status }: { id: number; status: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = nextTransferStatus(status);
  if (!next) return null;
  return (
    <button
      type="button"
      className="btn-primary px-3 py-1.5 text-sm"
      disabled={pending}
      onClick={() => start(async () => { await advanceTransferAction(id); router.refresh(); })}
    >
      {t("transfers.advance")}: {t(`transferstatus.${next}`)}
    </button>
  );
}
