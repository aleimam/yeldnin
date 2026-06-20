"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/i18n/client";
import { createDispositionAction, deleteDispositionAction } from "@/app/inquiries/actions";

/** Admin-only editor for the inquiry close dispositions (add / remove). The three
 *  defaults are seeded; removal is a soft-delete so closed inquiries keep theirs. */
export function DispositionEditor({
  dispositions,
}: {
  dispositions: { id: number; label: string; labelAr: string | null }[];
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [labelAr, setLabelAr] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const l = label.trim();
    if (!l) return;
    setBusy(true);
    const res = await createDispositionAction(l, labelAr.trim() || undefined);
    setBusy(false);
    if (res.ok) {
      setLabel("");
      setLabelAr("");
      router.refresh();
    }
  }

  async function remove(id: number) {
    setBusy(true);
    await deleteDispositionAction(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card mt-6 p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">{t("inq.dispositions")}</h2>
      <ul className="mb-3 divide-y divide-line">
        {dispositions.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-ink">{locale === "ar" && d.labelAr ? d.labelAr : d.label}</span>
            <button onClick={() => remove(d.id)} disabled={busy} className="text-xs text-red-600 hover:underline">
              {t("common.remove")}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("inq.dispoLabel")}
          className="input h-9 flex-1 py-1.5"
        />
        <input
          value={labelAr}
          onChange={(e) => setLabelAr(e.target.value)}
          placeholder={t("inq.dispoLabelAr")}
          dir="rtl"
          className="input h-9 flex-1 py-1.5"
        />
        <button onClick={add} disabled={busy || !label.trim()} className="btn-primary btn-sm">
          {t("inq.add")}
        </button>
      </div>
    </div>
  );
}
