"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { PhotoUpload, type UploadedPhoto } from "@/components/PhotoUpload";
import type { ReviewTeam } from "@/lib/review/review-logic";
import { setTripMarkAction, approveTripAction, holdTripAction } from "./actions";

export interface MarkView {
  team: string;
  status: string;
  note: string | null;
  photos: UploadedPhoto[];
}

export function TripReview({
  tripId,
  displayTeams,
  editableTeams,
  marks,
  isAdmin,
  converted,
}: {
  tripId: number;
  displayTeams: string[];
  editableTeams: string[];
  marks: MarkView[];
  isAdmin: boolean;
  converted: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const markOf = (team: string) => marks.find((m) => m.team === team);

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-semibold text-ink">{t("review.title")}</h2>

      <div className="space-y-3">
        {displayTeams.map((team) => (
          <MarkRow
            key={team}
            tripId={tripId}
            team={team}
            editable={editableTeams.includes(team) && !converted}
            mark={markOf(team)}
          />
        ))}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3 border-t border-line pt-3">
          {converted ? (
            <span className="text-sm text-green-600">{t("review.converted")}</span>
          ) : (
            <>
              <button
                onClick={() => start(async () => { await approveTripAction(tripId); router.refresh(); })}
                disabled={pending}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                {pending ? "…" : t("review.approve")}
              </button>
              <button
                onClick={() => start(async () => { await holdTripAction(tripId); router.refresh(); })}
                disabled={pending}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                {t("review.hold")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MarkRow({
  tripId,
  team,
  editable,
  mark,
}: {
  tripId: number;
  team: string;
  editable: boolean;
  mark?: MarkView;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState(mark?.status ?? "OK");
  const [note, setNote] = useState(mark?.note ?? "");
  const [photos, setPhotos] = useState<UploadedPhoto[]>(mark?.photos ?? []);
  const originalIds = new Set((mark?.photos ?? []).map((p) => p.id));

  const badge =
    mark?.status === "OK" ? (
      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">{t("review.ok")}</span>
    ) : mark?.status === "ISSUE" ? (
      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">{t("review.issue")}</span>
    ) : (
      <span className="text-xs text-muted">{t("review.pending")}</span>
    );

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await setTripMarkAction({
        tripId,
        team,
        status,
        note: note || undefined,
        photoIds: photos.map((p) => p.id).filter((id) => !originalIds.has(id)),
      });
      if (res.ok) { setSaved(true); router.refresh(); } else setError(res.error ?? "Error");
    });
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{t(`team.${team}`)}</span>
        {badge}
      </div>

      {editable ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <select className="input h-8 max-w-[8rem] py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="OK">{t("review.ok")}</option>
              <option value="ISSUE">{t("review.issue")}</option>
            </select>
            <button onClick={save} disabled={pending} className="btn-primary px-3 py-1 text-sm">
              {pending ? "…" : t("common.save")}
            </button>
            {saved && <span className="text-xs text-green-600">{t("review.saved")}</span>}
          </div>
          {status === "ISSUE" && (
            <>
              <textarea className="input" rows={2} placeholder={t("review.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
              <PhotoUpload photos={photos} onChange={setPhotos} />
            </>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        mark?.status === "ISSUE" && (
          <div className="mt-2">
            {mark.note && <p className="whitespace-pre-wrap text-sm text-ink">{mark.note}</p>}
            {mark.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {mark.photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="" className="h-14 w-14 rounded-lg border border-line object-cover" /></a>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
