import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getLocale } from "@/i18n/server";
import { getAccess } from "@/lib/auth/access";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { assetUrl } from "@/lib/assets/assets-service";
import { getPublishedPageBySlug } from "@/lib/content/content-pages-service";
import { renderMarkdown } from "@/lib/markdown";
import { SiteFooter } from "@/components/shell/SiteFooter";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPageBySlug(slug);
  return { title: page?.titleEn || "Not found" };
}

const article =
  "max-w-none [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_p]:my-3 [&_p]:leading-relaxed [&_a]:text-brand [&_a]:underline [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_blockquote]:border-s-4 [&_blockquote]:border-line [&_blockquote]:ps-4 [&_blockquote]:text-muted [&_hr]:my-6 [&_code]:rounded [&_code]:bg-canvas [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-slate-100";

// Public renderer for an admin-authored static page. PUBLIC pages render for anyone;
// INTERNAL pages require a session (else bounce to login). Bilingual.
export default async function PublicContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedPageBySlug(slug);
  if (!page) notFound();
  if (page.visibility === "INTERNAL") {
    const access = await getAccess();
    if (!access.user) redirect("/login");
  }

  const [locale, settings] = await Promise.all([getLocale(), getPlatformSettings()]);
  const ar = locale === "ar";
  const title = (ar ? page.titleAr : page.titleEn) || page.titleEn || page.titleAr;
  const body = (ar ? page.bodyAr : page.bodyEn) || page.bodyEn || page.bodyAr;
  const logo = assetUrl(settings.logoUrl);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt={settings.appName} className="h-8 w-auto" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-md bg-brand font-bold text-brand-fg">
                {settings.appName.charAt(0)}
              </span>
            )}
            <span className="text-lg font-bold text-brand">{settings.appName}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-ink">{title}</h1>
        <article className={article} dir={ar ? "rtl" : "ltr"} dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
      </main>

      <SiteFooter />
    </div>
  );
}
