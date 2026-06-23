import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { getAccess } from "@/lib/auth/access";
import { getPlatformSettings } from "@/lib/settings/settings-service";
import { assetUrl } from "@/lib/assets/assets-service";
import { BrandMark } from "@/components/BrandMark";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await getAccess();
  if (access.user) redirect("/");

  const [t, settings] = await Promise.all([getT(), getPlatformSettings()]);
  const { error } = await searchParams;
  const logo = assetUrl(settings.logoUrl);
  const darkLogo = assetUrl(settings.darkLogoUrl) ?? logo;

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex items-center justify-center gap-2">
          {logo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt={settings.appName} className="h-9 w-auto dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={darkLogo!} alt={settings.appName} className="hidden h-9 w-auto dark:block" />
            </>
          ) : (
            <BrandMark className="h-9 w-9" />
          )}
          <span className="text-2xl font-bold text-ink">{t("app.name")}</span>
        </div>
        <h1 className="mb-6 text-center text-lg font-semibold text-ink">
          {t("login.title")}
        </h1>

        {error && (
          <div className="mb-4 alert alert-error">
            {t("login.error")}
          </div>
        )}

        <LoginForm />
      </div>
    </main>
  );
}
