import type { Metadata } from "next";
import "./globals.css";
import { getLocale } from "@/i18n/server";
import { dir } from "@/i18n";
import { I18nProvider } from "@/i18n/client";

export const metadata: Metadata = {
  title: "YeldnIN",
  description: "Yeldn Internal Network — internal operations platform for Yeldn Health.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dir(locale)}>
      <body className="min-h-screen">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
