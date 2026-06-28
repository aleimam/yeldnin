"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { archiveEventAction } from "../../engagement-actions";

export function ArchiveEventButton({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      disabled={pending}
      onClick={() => { if (!window.confirm(t("eng.archiveConfirm"))) return; start(async () => { await archiveEventAction(id); router.push("/hr/engagement"); }); }}
    >
      {t("eng.archive")}
    </button>
  );
}
