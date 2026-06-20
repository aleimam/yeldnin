import { notFound, redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/access";
import { AppShell } from "@/components/shell/AppShell";
import { getT } from "@/i18n/server";
import { getTransaction, listCategories } from "@/lib/expenses/expenses-service";
import { canEditExpense } from "@/lib/expenses/expenses-logic";
import { ExpenseForm } from "../../../ExpenseForm";

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireModule("expenses", "VIEW");
  const { id } = await params;
  const tx = await getTransaction(Number(id));
  if (!tx) notFound();

  const editable = canEditExpense({
    isManager: access.can("expenses", "editAny"),
    isOwner: tx.createdById === access.user.id,
    hasEditPermission: access.can("expenses", "editOwn"),
    createdAt: tx.createdAt,
    now: new Date(),
  });
  if (!editable) redirect(`/expenses/transactions/${tx.id}`);

  const [t, categories] = await Promise.all([getT(), listCategories()]);
  const accruing = (tx.accruingDate ?? tx.createdAt).toISOString().slice(0, 10);

  return (
    <AppShell access={access} moduleKey="expenses" pageTitle={`${t("common.edit")} · #${tx.id}`} backHref={`/expenses/transactions/${tx.id}`}>
      <div className="max-w-2xl">
        <ExpenseForm
          categories={categories.map((c) => ({ id: c.id, name: c.name, nameAr: c.nameAr }))}
          txId={tx.id}
          initial={{ categoryId: tx.categoryId ?? undefined, amount: String(tx.amount), note: tx.note ?? "", accruingDate: accruing }}
        />
      </div>
    </AppShell>
  );
}
