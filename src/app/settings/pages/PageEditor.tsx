"use client";
import { useState } from "react";
import { useT } from "@/i18n/client";
import { renderMarkdown } from "@/lib/markdown";

export interface EditablePage {
  id: number;
  slug: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  visibility: string;
  published: boolean;
  showInFooter: boolean;
  showInMenu: boolean;
  sortOrder: number;
}

const preview =
  "max-w-none rounded-lg border border-line bg-canvas p-3 text-sm [&_h1]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_blockquote]:border-s-4 [&_blockquote]:ps-3 [&_blockquote]:text-muted";

export function PageEditor({
  page,
  action,
  error,
}: {
  page: EditablePage | null;
  action: (fd: FormData) => void | Promise<void>;
  error?: string;
}) {
  const t = useT();
  const [bodyEn, setBodyEn] = useState(page?.bodyEn ?? "");
  const [bodyAr, setBodyAr] = useState(page?.bodyAr ?? "");

  return (
    <div className="max-w-4xl space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <form action={action} className="card space-y-4 p-6">
        {page && <input type="hidden" name="id" value={page.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("pages.slug")}</label>
            <input name="slug" defaultValue={page?.slug} placeholder="privacy-policy" required className="input font-mono" />
            <p className="mt-1 text-[11px] text-muted">{t("pages.slugHint")}</p>
          </div>
          <div>
            <label className="label">{t("pages.sort")}</label>
            <input name="sortOrder" type="number" defaultValue={page?.sortOrder ?? 0} className="input" />
          </div>
          <div>
            <label className="label">{t("pages.titleEn")}</label>
            <input name="titleEn" defaultValue={page?.titleEn} required className="input" />
          </div>
          <div>
            <label className="label">{t("pages.titleAr")}</label>
            <input name="titleAr" defaultValue={page?.titleAr} dir="rtl" className="input" />
          </div>
        </div>

        <div>
          <label className="label">{t("pages.bodyEn")} <span className="font-normal text-muted">· {t("pages.markdownHint")}</span></label>
          <div className="grid gap-3 md:grid-cols-2">
            <textarea name="bodyEn" value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} rows={12} className="input font-mono" />
            <div className={preview} dangerouslySetInnerHTML={{ __html: renderMarkdown(bodyEn) || `<span class="text-muted">${t("pages.preview")}</span>` }} />
          </div>
        </div>

        <div>
          <label className="label">{t("pages.bodyAr")}</label>
          <div className="grid gap-3 md:grid-cols-2">
            <textarea name="bodyAr" value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} dir="rtl" rows={12} className="input font-mono" />
            <div dir="rtl" className={preview} dangerouslySetInnerHTML={{ __html: renderMarkdown(bodyAr) || `<span class="text-muted">${t("pages.preview")}</span>` }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="label">{t("pages.visibility")}</label>
            <select name="visibility" defaultValue={page?.visibility ?? "PUBLIC"} className="input">
              <option value="PUBLIC">{t("pages.public")}</option>
              <option value="INTERNAL">{t("pages.internal")}</option>
            </select>
          </div>
          <label className="flex items-center gap-1.5 self-end pb-2 text-sm"><input type="checkbox" name="published" defaultChecked={page?.published ?? false} /> {t("pages.published")}</label>
          <label className="flex items-center gap-1.5 self-end pb-2 text-sm"><input type="checkbox" name="showInFooter" defaultChecked={page?.showInFooter ?? true} /> {t("pages.footer")}</label>
          <label className="flex items-center gap-1.5 self-end pb-2 text-sm"><input type="checkbox" name="showInMenu" defaultChecked={page?.showInMenu ?? true} /> {t("pages.menu")}</label>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-primary">{t("common.save")}</button>
          {page && <a href={`/p/${page.slug}`} target="_blank" rel="noreferrer" className="btn-secondary">{t("pages.view")} ↗</a>}
        </div>
      </form>
    </div>
  );
}
