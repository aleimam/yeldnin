"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import {
  parseSupplementForm,
  parseDeviceForm,
  type FieldErrors,
} from "@/lib/pricing/pricing-form-logic";
import {
  createSupplementCalculation,
  createDeviceCalculation,
  softDeleteCalculation,
  getCalculation,
} from "@/lib/pricing/pricing-service";

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
  const access = await requireModule("egv_pricer", "OPERATE");
  const parsed = parseSupplementForm(p.values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };

  const calc = await createSupplementCalculation(parsed.input, {
    productName: p.productName,
    supplierId: p.supplierId ?? null,
    notes: p.notes,
    photoAssetIds: p.photoIds,
    userId: access.user.id,
  });
  revalidatePath("/pricer/history");
  return { ok: true, price: calc.price, id: calc.id };
}

export async function calcDeviceAction(p: CalcPayload): Promise<CalcResult> {
  const access = await requireModule("egv_pricer", "OPERATE");
  const parsed = parseDeviceForm(p.values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };

  const calc = await createDeviceCalculation(parsed.input, {
    productName: p.productName,
    supplierId: p.supplierId ?? null,
    notes: p.notes,
    photoAssetIds: p.photoIds,
    userId: access.user.id,
  });
  revalidatePath("/pricer/history");
  return { ok: true, price: calc.price, id: calc.id };
}

export async function deleteCalculationAction(id: number): Promise<void> {
  const access = await requireModule("egv_pricer", "OPERATE");
  const calc = await getCalculation(id);
  if (!calc || calc.deletedAt) return;
  // Owner can delete their own; MANAGE can delete any.
  if (calc.userId !== access.user.id && !access.canModule("egv_pricer", "MANAGE")) {
    return;
  }
  await softDeleteCalculation(id, access.user.id);
  revalidatePath("/pricer/history");
}
