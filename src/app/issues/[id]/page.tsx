import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { assetUrl } from "@/lib/assets/assets-service";
import { getIssue } from "@/lib/issues/issues-service";
import { issueVisibility, issueVisible } from "@/lib/issues/issues-logic";
import { IssueResolveButton, CompensationForm } from "../IssueActions";
import { IssueSettleButton } from "@/app/exceptions/IssueSettleButton";

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("issues", "VIEW");
  const vis = issueVisibility(access);
  if (!vis) redirect("/");
  const { id } = await params;
  const issue = await getIssue(Number(id));
  // Domain-scoped: an off-scope issue is invisible (XOONX never sees VEEEY or
  // unscoped back-office issues, Sales never sees any).
  if (!issue || !issueVisible(vis, issue.scope)) notFound();
  const canManage = access.can("issues", "operate");
  const canSettle = access.isAdmin || access.can("logistics", "operate") || access.can("operations", "operate");
  const t = await getT();

  return (
    <AppShell access={access} moduleKey="issues" pageTitle={issue.uid ?? `#${issue.id}`} backHref="/issues">
      <div className="max-w-3xl space-y-6">
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">{issue.title}</h2>
              <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] ${issue.status === "OPEN" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {issue.status === "OPEN" ? t("issues.open") : t("issues.solved")}
              </span>
              {issue.outcome && <span className="ms-2 inline-block rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">{t(`exceptions.outcome.${issue.outcome}`)}</span>}
              {issue.sourceType === "TRIP_MARK" && <span className="ms-2 text-xs text-muted">{t("issues.fromReview")}</span>}
            </div>
            <div className="flex items-center gap-2">
              {canSettle && issue.sourceType === "EXCEPTION" && issue.status === "OPEN" && <IssueSettleButton issueId={issue.id} />}
              {canManage && <IssueResolveButton id={issue.id} status={issue.status} />}
            </div>
          </div>
          {issue.note && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{issue.note}</p>}
          {issue.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {issue.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={p.id} href={assetUrl(p.assetId)!} target="_blank" rel="noreferrer"><img src={assetUrl(p.assetId)!} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" /></a>
              ))}
            </div>
          )}
          {issue.items.length > 0 && (
            <div className="mt-3">
              <div className="label">{t("issues.relatedItems")}</div>
              <ul className="text-sm text-ink">{issue.items.map((it) => <li key={it.id}>{it.label}</li>)}</ul>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold text-ink">{t("issues.compensations")}</h3>
          {issue.compensations.length === 0 ? (
            <p className="mb-3 text-sm text-muted">{t("issues.noComps")}</p>
          ) : (
            <table className="mb-3 w-full text-sm">
              <tbody className="divide-y divide-line">
                {issue.compensations.map((c) => (
                  <tr key={c.id}>
                    <td className="td">{t(`comptype.${c.type}`)}</td>
                    <td className="td text-muted">{c.type === "MONEY" && c.amountEgp != null ? `${c.amountEgp.toLocaleString()} EGP` : c.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {canManage && <CompensationForm issueId={issue.id} />}
        </div>
      </div>
    </AppShell>
  );
}
