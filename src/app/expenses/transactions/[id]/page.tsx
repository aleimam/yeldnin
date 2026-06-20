import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT, getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { assetUrl } from "@/lib/assets/assets-service";
import { displayName } from "@/lib/users/users-logic";
import { getTransaction, userNameMap, canFlagExpense } from "@/lib/expenses/expenses-service";
import { categoryLabel } from "@/lib/expenses/category-label";
import { canEditExpense } from "@/lib/expenses/expenses-logic";
import { formatBizDate } from "@/lib/format/dates";
import { FlagControls } from "../../FlagControls";
import { deleteTransactionAction, deleteAttachmentAction } from "../../actions";

const FLAG_BANNER: Record<string, string> = {
  RED: "border-red-300 bg-red-50 text-red-700",
  YELLOW: "border-amber-300 bg-amber-50 text-amber-700",
};

/** Registering timestamp as "17 Jul · 14:32" (UTC parts — matches formatBizDate, locale-stable). */
function registeredAt(d: Date): string {
  return `${formatBizDate(d)} · ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("expenses", "VIEW");
  const { id } = await params;
  const tx = await getTransaction(Number(id));
  if (!tx) notFound();
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const editable = canEditExpense({
    isManager: access.can("expenses", "editAny"),
    isOwner: tx.createdById === access.user.id,
    hasEditPermission: access.can("expenses", "editOwn"),
    createdAt: tx.createdAt,
    now: new Date(),
  });
  const canDelete = access.can("expenses", "deleteTxn") || editable;
  const canFlag = canFlagExpense(access);

  const [assets, flaggerNames] = await Promise.all([
    prisma.asset.findMany({ where: { id: { in: tx.attachments.map((a) => a.assetId) } } }),
    userNameMap([tx.flaggedById]),
  ]);
  const mimeOf = new Map(assets.map((a) => [a.id, a.mimeType]));
  const flaggerName = tx.flaggedById ? flaggerNames.get(tx.flaggedById) ?? `#${tx.flaggedById}` : null;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-end font-medium text-ink">{children}</span>
    </div>
  );

  return (
    <AppShell
      access={access}
      moduleKey="expenses"
      pageTitle={`#${tx.id} · ${categoryLabel(t, tx.categoryNameSnapshot, locale)}`}
      backHref="/expenses/transactions"
      actions={editable ? <Link href={`/expenses/transactions/${tx.id}/edit`} className="btn-primary">{t("common.edit")}</Link> : null}
    >
      {tx.flag && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${FLAG_BANNER[tx.flag] ?? "border-line"}`}>
          <span className="font-medium">🚩 {t("exp.flaggedBanner")} · {t(tx.flag === "RED" ? "exp.flagRed" : "exp.flagYellow")}</span>
          {tx.flagNote && <span> — {tx.flagNote}</span>}
          {flaggerName && <span className="opacity-80"> ({flaggerName}{tx.flaggedAt ? ` · ${formatBizDate(tx.flaggedAt)}` : ""})</span>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 font-semibold text-ink">{t("exp.details")}</h2>
          <Row label={t("exp.category")}>{categoryLabel(t, tx.categoryNameSnapshot, locale)}</Row>
          <Row label={t("exp.type")}>{tx.categoryTypeSnapshot === "TRANSFER" ? t("exp.transfer") : t("exp.expense")}</Row>
          <Row label={t("exp.amount")}>{Math.round(tx.amount).toLocaleString()} EGP</Row>
          <Row label={t("exp.accruingDate")}>{formatBizDate(tx.accruingDate ?? tx.createdAt)}</Row>
          <Row label={t("exp.registered")}>{registeredAt(tx.createdAt)}</Row>
          <Row label={t("exp.createdBy")}>{displayName(tx.createdBy, locale)}</Row>
          {tx.note && <Row label={t("exp.note")}>{tx.note}</Row>}
        </div>

        <div className="space-y-6">
          {canFlag && (
            <div className="card p-6">
              <FlagControls id={tx.id} current={tx.flag} currentNote={tx.flagNote} />
            </div>
          )}

          <div className="card p-6">
            <h2 className="mb-2 font-semibold text-ink">{t("exp.attachments")}</h2>
            <div className="flex flex-wrap gap-2">
              {tx.attachments.map((a) => {
                const url = assetUrl(a.assetId)!;
                const isImg = (mimeOf.get(a.assetId) ?? "").startsWith("image/");
                return (
                  <div key={a.id} className="group relative">
                    <a href={url} target="_blank" rel="noreferrer">
                      {isImg ? (
                        <img src={url} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
                      ) : (
                        <span className="grid h-16 w-16 place-items-center rounded-lg border border-line text-2xl">📄</span>
                      )}
                    </a>
                    {editable && (
                      <form action={deleteAttachmentAction} className="absolute -end-1.5 -top-1.5">
                        <input type="hidden" name="attachmentId" value={a.id} />
                        <button className="grid h-5 w-5 place-items-center rounded-full bg-red-600 text-xs text-white opacity-0 transition group-hover:opacity-100">×</button>
                      </form>
                    )}
                  </div>
                );
              })}
              {tx.attachments.length === 0 && <span className="text-sm text-muted">—</span>}
            </div>
          </div>

          {canDelete && (
            <form action={deleteTransactionAction}>
              <input type="hidden" name="id" value={tx.id} />
              <button className="btn-danger">{t("common.delete")}</button>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
