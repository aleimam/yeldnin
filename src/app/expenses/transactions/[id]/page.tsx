import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { assetUrl } from "@/lib/assets/assets-service";
import { getTransaction, listCategories } from "@/lib/expenses/expenses-service";
import { canEditExpense } from "@/lib/expenses/expenses-logic";
import { ExpensesNav } from "../../ExpensesNav";
import { ExpenseForm } from "../../ExpenseForm";
import { deleteTransactionAction, deleteAttachmentAction } from "../../actions";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireModule("expenses", "VIEW");
  const { id } = await params;
  const tx = await getTransaction(Number(id));
  if (!tx) notFound();
  const [t, categories] = await Promise.all([getT(), listCategories()]);

  const editable = canEditExpense({
    isManager: access.canModule("expenses", "MANAGE"),
    isOwner: tx.createdById === access.user.id,
    hasEditPermission: access.canModule("expenses", "OPERATE"),
    createdAt: tx.createdAt,
    now: new Date(),
  });
  const canDelete = access.canModule("expenses", "MANAGE") || editable;

  const assets = await prisma.asset.findMany({
    where: { id: { in: tx.attachments.map((a) => a.assetId) } },
  });
  const mimeOf = new Map(assets.map((a) => [a.id, a.mimeType]));

  return (
    <AppShell user={access.user} title={`#${tx.id} · ${tx.categoryNameSnapshot}`} backHref="/expenses/transactions">
      <ExpensesNav canManage={access.canModule("expenses", "MANAGE")} />

      <div className="grid gap-6 lg:grid-cols-2">
        {editable ? (
          <ExpenseForm
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            txId={tx.id}
            initial={{ categoryId: tx.categoryId ?? undefined, amount: String(tx.amount), note: tx.note ?? "" }}
          />
        ) : (
          <div className="card space-y-3 p-6">
            <div><span className="text-muted">{t("exp.category")}: </span>{tx.categoryNameSnapshot}</div>
            <div><span className="text-muted">{t("exp.amount")}: </span>{Math.round(tx.amount).toLocaleString()} EGP</div>
            {tx.note && <div><span className="text-muted">{t("exp.note")}: </span>{tx.note}</div>}
            <p className="text-sm text-amber-600">{t("exp.editWindowOver")}</p>
          </div>
        )}

        <div className="card space-y-4 p-6">
          <div className="text-sm text-muted">
            {t("exp.createdBy")}: {tx.createdBy.name} · {new Date(tx.createdAt).toLocaleString()}
          </div>

          <div>
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
