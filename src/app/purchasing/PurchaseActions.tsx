"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { nextPurchaseStatus } from "@/lib/purchasing/purchasing-logic";
import { advancePurchaseStatusAction, receivePurchaseAtOfficeAction } from "./actions";

/**
 * Purchasing/logistics controls on a purchase: Dispatch (→ create a patch),
 * Receive at office (bypass patches), or advance the status. Hidden once the
 * purchase's units are on the website.
 */
export function PurchaseActions({
  id,
  status,
  hasOrdered,
  locked,
}: {
  id: number;
  status: string;
  hasOrdered: boolean;
  locked: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (locked) return null;
  const next = nextPurchaseStatus(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "NEW" && hasOrdered && (
        <Link href={`/patches/new?purchase=${id}`} className="btn-primary px-3 py-1.5 text-sm">
          {t("purchasing.dispatch")}
        </Link>
      )}
      {status === "NEW" && hasOrdered && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await receivePurchaseAtOfficeAction(id); router.refresh(); })}
          className="btn-secondary px-3 py-1.5 text-sm"
        >
          {pending ? "…" : t("purchasing.receiveAtOffice")}
        </button>
      )}
      {status !== "NEW" && next && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await advancePurchaseStatusAction(id); router.refresh(); })}
          className="btn-primary px-3 py-1.5 text-sm"
        >
          {pending ? "…" : `${t("purchasing.advanceTo")} ${t(`purchasestatus.${next}`)}`}
        </button>
      )}
    </div>
  );
}
