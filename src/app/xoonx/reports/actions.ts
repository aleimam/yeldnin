"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { closeMonth } from "@/lib/xoonx/xoonx-finance-service";

export async function closeMonthAction(month: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await requireCapability("xoonx", "manage");
  try {
    await closeMonth(month, a.user.id, new Date());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath("/xoonx/reports");
  revalidatePath("/xoonx/expenses");
  return { ok: true };
}
