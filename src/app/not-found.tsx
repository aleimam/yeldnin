import Link from "next/link";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-md space-y-4 p-6 text-center">
        <div className="text-4xl font-bold text-brand">404</div>
        <h1 className="text-lg font-semibold text-ink">{t("state.notFoundTitle")}</h1>
        <p className="text-sm text-muted">{t("state.notFoundBody")}</p>
        <Link href="/" className="btn-primary inline-block">{t("common.goHome")}</Link>
      </div>
    </div>
  );
}
