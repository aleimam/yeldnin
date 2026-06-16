"use client";
import { useTransition } from "react";
import { useT } from "@/i18n/client";
import { deleteCalculationAction } from "./actions";

export function DeleteButton({ id }: { id: number }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this calculation?")) {
          start(() => deleteCalculationAction(id));
        }
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {t("pricer.delete")}
    </button>
  );
}
