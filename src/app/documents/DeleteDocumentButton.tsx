"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { TrashIcon } from "@/components/icons/TrashIcon";
import { deleteDocumentAction } from "./actions";

/** Double-confirmed soft-delete (archive) of a document. */
export function DeleteDocumentButton({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove() {
    if (!window.confirm(t("docs.confirmDelete"))) return;
    start(async () => {
      const r = await deleteDocumentAction(id);
      if (r.ok) router.push("/documents");
    });
  }

  return (
    <button type="button" onClick={remove} disabled={pending} className="btn-secondary btn-sm text-red-600">
      <TrashIcon className="me-1 inline h-4 w-4" />
      {pending ? "…" : t("docs.delete")}
    </button>
  );
}
