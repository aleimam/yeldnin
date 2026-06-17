"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { addGiftItemsAction } from "./actions";

/** Add free gift units (received from the supplier) to a purchase. */
export function AddGiftForm({ purchaseId, products }: { purchaseId: number; products: { id: number; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [productId, setProductId] = useState("");
  const [count, setCount] = useState("1");
  if (!products.length) return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select className="input w-48" value={productId} onChange={(e) => setProductId(e.target.value)}>
        <option value="">{t("purchasing.giftProduct")}…</option>
        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input type="number" min={1} className="input w-20" value={count} onChange={(e) => setCount(e.target.value)} />
      <button
        type="button"
        disabled={pending || !productId}
        className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
        onClick={() =>
          start(async () => {
            await addGiftItemsAction({ purchaseId, productId: Number(productId), count: Number(count) || 1 });
            setProductId("");
            setCount("1");
            router.refresh();
          })
        }
      >
        {pending ? "…" : t("purchasing.addGift")}
      </button>
    </div>
  );
}
