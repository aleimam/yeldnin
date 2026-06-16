import Link from "next/link";
import { requireUser } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { globalSearch } from "@/lib/search/search-service";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const access = await requireUser();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const [t, groups] = await Promise.all([
    getT(),
    query ? globalSearch(access, query, 25) : Promise.resolve([]),
  ]);
  const total = groups.reduce((n, g) => n + g.hits.length, 0);

  return (
    <AppShell access={access} moduleKey="search" pageTitle={t("search.title")}>
      <div className="max-w-3xl space-y-6">
        <p className="text-sm text-muted">
          {query ? `${t("search.resultsFor")} “${query}”` : t("search.prompt")}
        </p>

        {query && total === 0 && (
          <div className="card p-5 text-sm text-muted">{t("search.noResults")}</div>
        )}

        {groups.map((g) => (
          <div key={g.type} className="card p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t(g.labelKey)}</h2>
            <ul className="divide-y divide-line/60">
              {g.hits.map((h) => (
                <li key={`${h.type}-${h.id}`}>
                  <Link
                    href={h.href}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-canvas"
                  >
                    <span className="truncate text-ink">{h.title}</span>
                    {h.subtitle && <span className="shrink-0 font-mono text-xs text-muted">{h.subtitle}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
