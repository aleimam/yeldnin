"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { nextPurchaseStatus, prevPurchaseStatus, purchaseCascadeCount } from "@/lib/purchasing/purchasing-logic";
import { setPurchaseStatusAction, receivePurchaseAtOfficeAction } from "./actions";

/**
 * Purchasing/logistics controls on a purchase: Dispatch (→ create a patch),
 * Receive at office (bypass patches), or step the status forward/back. Any status
 * step cascades to the purchase's patches and items, so it is confirmed first
 * (the dialog shows how many units move). Hidden once units are on the website.
 */
export function PurchaseActions({
  id,
  status,
  hasOrdered,
  locked,
  items,
}: {
  id: number;
  status: string;
  hasOrdered: boolean;
  locked: boolean;
  items: { status: string; exceptionFlag: string | null }[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  if (locked) return null;
  const next = nextPurchaseStatus(status);
  const prev = prevPurchaseStatus(status);
  const count = purchaseCascadeCount(items, status);

  const apply = (to: string) =>
    start(async () => {
      await setPurchaseStatusAction(id, to);
      setTarget(null);
      router.refresh();
    });

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
      {status !== "NEW" && prev && (
        <button type="button" disabled={pending} onClick={() => setTarget(prev)} className="btn-secondary px-3 py-1.5 text-sm">
          ← {t(`purchasestatus.${prev}`)}
        </button>
      )}
      {status !== "NEW" && next && (
        <button type="button" disabled={pending} onClick={() => setTarget(next)} className="btn-primary px-3 py-1.5 text-sm">
          {t(`purchasestatus.${next}`)} →
        </button>
      )}

      {target && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setTarget(null)}
        >
          <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 font-semibold text-ink">{t("purchasing.cascadeTitle")}</h3>
            <p className="text-sm text-muted">
              {t("purchasing.cascadeBody", {
                count,
                from: t(`purchasestatus.${status}`),
                to: t(`purchasestatus.${target}`),
              })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setTarget(null)} className="btn-secondary px-3 py-1.5 text-sm">
                {t("common.cancel")}
              </button>
              <button type="button" disabled={pending} onClick={() => apply(target)} className="btn-primary px-3 py-1.5 text-sm">
                {pending ? "…" : t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
