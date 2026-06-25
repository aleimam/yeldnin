"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { restoreVersionAction } from "./actions";

/** Restore a prior version (Manage). Confirms first; appends a new snapshot. */
export function RestoreVersionButton({ id, versionId }: { id: number; versionId: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          if (!confirm(t("docs.ver.confirmRestore"))) return;
          await restoreVersionAction(id, versionId);
          router.refresh();
        })
      }
      disabled={pending}
      className="btn-secondary btn-sm"
    >
      {t("docs.ver.restore")}
    </button>
  );
}
