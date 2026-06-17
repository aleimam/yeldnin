"use server";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/access";
import { productScopes, isScope, type Scope } from "@/lib/products/products-logic";
import { normalizeImportRow } from "@/lib/products/products-import-logic";
import { importProducts } from "@/lib/products/products-service";

export type ImportResult = { ok: true; created: number; skipped: number } | { ok: false; error: string };

export async function importProductsAction(formData: FormData): Promise<ImportResult> {
  const access = await requireUser();
  const scope = String(formData.get("scope") ?? "");
  if (!isScope(scope) || !productScopes(access, "OPERATE").includes(scope as Scope)) {
    return { ok: false, error: "You can't import products in that scope." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a spreadsheet file." };

  try {
    const wb = new ExcelJS.Workbook();
    // exceljs's bundled Buffer type lags @types/node's generic Buffer — cast for load().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as any);
    const ws = wb.worksheets[0];
    if (!ws) return { ok: false, error: "The file has no sheets." };

    const headers = ((ws.getRow(1).values as unknown[]) ?? []).slice(1).map((h) => String(h ?? "").trim());
    const raw: Record<string, unknown>[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return; // header
      const vals = (row.values as unknown[]).slice(1);
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = vals[i];
      });
      raw.push(obj);
    });

    const rows = raw
      .map((r) => normalizeImportRow(r, scope as Scope))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const created = await importProducts(rows, scope as Scope, access.user.id);
    revalidatePath("/products");
    return { ok: true, created, skipped: raw.length - rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't read the file." };
  }
}
