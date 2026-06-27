"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { Combobox } from "@/components/Combobox";
import { addGiftItemsAction } from "./actions";

/** Add free gift units (received from the supplier) to a purchase. */
export function AddGiftForm({ purchaseId, products }: { purchaseId: number; products: { id: number; name: string; sku: string | null }[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [productId, setProductId] = useState("");
  const [count, setCount] = useState("1");
  if (!products.length) return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Combobox
        className="w-48"
        placeholder={`${t("purchasing.giftProduct")}…`}
        value={productId}
        onChange={setProductId}
        options={products.map((p) => ({ value: String(p.id), label: p.name, hint: p.sku ?? undefined }))}
      />
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
