import Link from "next/link";
import { getLocale } from "@/i18n/server";
import { listFooterPages } from "@/lib/content/content-pages-service";
import { getPlatformSettings } from "@/lib/settings/settings-service";

/** Footer: admin-editable copyright note + any published "show in footer" pages. */
export async function SiteFooter() {
  const [locale, pages, settings] = await Promise.all([getLocale(), listFooterPages(), getPlatformSettings()]);
  const ar = locale === "ar";
  const copyright = (ar ? settings.copyrightAr : settings.copyrightEn) || settings.copyrightEn || settings.copyrightAr;
  if (pages.length === 0 && !copyright) return null;
  return (
    <footer className="border-t border-line py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 text-sm text-muted">
        {pages.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {pages.map((p) => (
              <Link key={p.slug} href={`/p/${p.slug}`} className="hover:text-ink">
                {(ar ? p.titleAr : p.titleEn) || p.titleEn}
              </Link>
            ))}
          </div>
        )}
        {copyright && <div className="text-xs text-muted">{copyright}</div>}
      </div>
    </footer>
  );
}
