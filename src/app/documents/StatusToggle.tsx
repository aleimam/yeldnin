"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { setDocumentStatusAction } from "./actions";

/** Publish (DRAFT → PUBLISHED) or move back to draft (PUBLISHED → DRAFT). */
export function StatusToggle({ id, status }: { id: number; status: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

  function toggle() {
    start(async () => {
      await setDocumentStatusAction(id, next);
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={toggle} disabled={pending} className="btn-secondary btn-sm">
      {pending ? "…" : status === "PUBLISHED" ? t("docs.unpublish") : t("docs.publish")}
    </button>
  );
}
