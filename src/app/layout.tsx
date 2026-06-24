import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLocale } from "@/i18n/server";
import { dir } from "@/i18n";
import { I18nProvider } from "@/i18n/client";
import { getEffectiveTheme, getColorMode } from "@/lib/prefs";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { assetUrl } from "@/lib/assets/assets-service";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { EnterSubmit } from "@/components/EnterSubmit";
import { NavProgress } from "@/components/NavProgress";
import { ErrorReporter } from "@/components/ErrorReporter";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getPlatformSettings();
  const favicon = assetUrl(s.faviconUrl);
  return {
    title: s.appName,
    description: "Yeldn Internal Network — internal operations platform.",
    icons: {
      icon: favicon ?? "/icon.svg",
      apple: "/icon.svg",
    },
    appleWebApp: { capable: true, statusBarStyle: "default", title: s.appName },
  };
}

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

// Runs before paint: reconcile the dark class from the mode cookie / system pref.
const NO_FLASH = `(function(){try{var d=document.documentElement;var m=(document.cookie.match(/(?:^|; )yeldnin_mode=([^;]+)/)||[])[1]||'system';var dark=m==='dark'||(m!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.classList.toggle('dark',!!dark);}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, theme, mode] = await Promise.all([
    getLocale(),
    getEffectiveTheme(),
    getColorMode(),
  ]);

  return (
    <html
      lang={locale}
      dir={dir(locale)}
      data-theme={theme}
      className={mode === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <body className="min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        <ServiceWorkerRegister />
        <ErrorReporter />
        <EnterSubmit />
        <NavProgress />
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
