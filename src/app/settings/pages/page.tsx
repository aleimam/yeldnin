import Link from "next/link";
import { requireCapability } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { listPages } from "@/lib/content/content-pages-service";

export default async function PagesListPage() {
  const access = await requireCapability("settings", "managePages");
  const [t, pages] = await Promise.all([getT(), listPages()]);

  return (
    <AppShell
      access={access}
      moduleKey="settings"
      pageTitle={t("pages.title")}
      backHref="/settings"
      actions={<Link href="/settings/pages/new" className="btn-primary">+ {t("pages.new")}</Link>}
    >
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th">{t("pages.titleEn")}</th>
              <th className="th">{t("pages.slug")}</th>
              <th className="th">{t("pages.visibility")}</th>
              <th className="th">{t("pages.published")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {pages.map((p) => (
              <tr key={p.id} className="hover:bg-canvas/60">
                <td className="td">
                  <Link href={`/settings/pages/${p.id}`} className="font-medium text-brand hover:underline">{p.titleEn}</Link>
                </td>
                <td className="td font-mono text-muted">/p/{p.slug}</td>
                <td className="td">{p.visibility === "INTERNAL" ? t("pages.internal") : t("pages.public")}</td>
                <td className="td">{p.published ? <span className="text-green-600">●</span> : <span className="text-muted">○</span>}</td>
              </tr>
            ))}
            {pages.length === 0 && <tr><td className="td text-muted" colSpan={4}>{t("pages.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
