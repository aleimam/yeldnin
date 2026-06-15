import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { getAccess } from "@/lib/auth/access";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await getAccess();
  if (access.user) redirect("/");

  const t = await getT();
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-brand text-lg text-brand-fg">
            ✦
          </span>
          <span className="text-2xl font-bold text-ink">{t("app.name")}</span>
        </div>
        <h1 className="mb-6 text-center text-lg font-semibold text-ink">
          {t("login.title")}
        </h1>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {t("login.error")}
          </div>
        )}

        <form method="POST" action="/api/login" className="space-y-4">
          <div>
            <label htmlFor="email" className="label">
              {t("login.email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="input"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              {t("login.password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            {t("login.submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
