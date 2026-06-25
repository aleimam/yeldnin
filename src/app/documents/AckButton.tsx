"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { acknowledgeDocumentAction } from "./actions";

/** "Read & acknowledge" — records that the viewer has read a published document. */
export function AckButton({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(async () => { await acknowledgeDocumentAction(id); router.refresh(); })}
      disabled={pending}
      className="btn-primary btn-sm"
    >
      ✓ {t("docs.ack.button")}
    </button>
  );
}
