import Link from "next/link";
import { getLocale } from "@/i18n/server";
import { listFooterPages } from "@/lib/content/content-pages-service";

/** Footer that lists published "show in footer" content pages. */
export async function SiteFooter() {
  const [locale, pages] = await Promise.all([getLocale(), listFooterPages()]);
  const ar = locale === "ar";
  if (pages.length === 0) return null;
  return (
    <footer className="border-t border-line py-6">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-6 gap-y-2 px-4 text-sm text-muted">
        {pages.map((p) => (
          <Link key={p.slug} href={`/p/${p.slug}`} className="hover:text-ink">
            {(ar ? p.titleAr : p.titleEn) || p.titleEn}
          </Link>
        ))}
      </div>
    </footer>
  );
}
