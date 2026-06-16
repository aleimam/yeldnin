"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import {
  parseSupplementForm,
  parseDeviceForm,
  type FieldErrors,
} from "@/lib/pricing/pricing-form-logic";
import {
  createSupplementCalculation,
  createDeviceCalculation,
  softDeleteCalculation,
  hardDeleteCalculation,
  hardDeleteAllHistory,
  getCalculation,
} from "@/lib/pricing/pricing-service";
import { writeAudit } from "@/lib/audit";

export type CalcResult =
  | { ok: true; price: number; id: number }
  | { ok: false; fieldErrors: FieldErrors };

interface CalcPayload {
  values: Record<string, unknown>;
  productName?: string;
  supplierId?: number | null;
  notes?: string;
  photoIds?: string[];
}

export async function calcSupplementAction(p: CalcPayload): Promise<CalcResult> {
  const access = await requireCapability("pricing", "calculate");
  const parsed = parseSupplementForm(p.values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };

  const calc = await createSupplementCalculation(parsed.input, {
    productName: p.productName,
    supplierId: p.supplierId ?? null,
    notes: p.notes,
    photoAssetIds: p.photoIds,
    userId: access.user.id,
  });
  revalidatePath("/pricing/history");
  return { ok: true, price: calc.price, id: calc.id };
}

export async function calcDeviceAction(p: CalcPayload): Promise<CalcResult> {
  const access = await requireCapability("pricing", "calculate");
  const parsed = parseDeviceForm(p.values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };

  const calc = await createDeviceCalculation(parsed.input, {
    productName: p.productName,
    supplierId: p.supplierId ?? null,
    notes: p.notes,
    photoAssetIds: p.photoIds,
    userId: access.user.id,
  });
  revalidatePath("/pricing/history");
  return { ok: true, price: calc.price, id: calc.id };
}

export async function deleteCalculationAction(id: number): Promise<void> {
  const access = await requireCapability("pricing", "deleteOwn");
  const calc = await getCalculation(id);
  if (!calc || calc.deletedAt) return;
  // Owner can soft-delete their own; deleting someone else's needs deleteAny.
  if (calc.userId !== access.user.id && !access.can("pricing", "deleteAny")) {
    return;
  }
  await softDeleteCalculation(id, access.user.id);
  revalidatePath("/pricing/history");
}

/** Permanently remove one calculation. Requires the deleteAny capability. */
export async function hardDeleteCalculationAction(id: number): Promise<void> {
  const access = await requireCapability("pricing", "deleteAny");
  const calc = await getCalculation(id);
  if (!calc) return;
  await hardDeleteCalculation(id);
  await writeAudit(access.user.id, "pricing", "calc.hardDelete", "pricingCalculation", id, {
    productName: calc.productName,
  });
  revalidatePath("/pricing/history");
}

/** Permanently wipe the entire calculation history. Requires deleteAny. */
export async function purgeHistoryAction(): Promise<void> {
  const access = await requireCapability("pricing", "deleteAny");
  await hardDeleteAllHistory();
  await writeAudit(access.user.id, "pricing", "calc.purgeAll", "pricingCalculation", "all");
  revalidatePath("/pricing/history");
}
