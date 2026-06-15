"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import {
  createSupplier,
  updateSupplier,
  archiveSupplier,
} from "@/lib/suppliers/suppliers-service";

const on = (fd: FormData, k: string) => fd.get(k) === "on";

export async function createSupplierAction(fd: FormData): Promise<void> {
  await requireModule("settings", "MANAGE");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  await createSupplier({
    name,
    availableUSA: on(fd, "availableUSA"),
    availableUK: on(fd, "availableUK"),
    availableEU: on(fd, "availableEU"),
    contact: String(fd.get("contact") ?? "").trim() || undefined,
  });
  revalidatePath("/settings/logistics");
}

export async function updateSupplierAction(fd: FormData): Promise<void> {
  await requireModule("settings", "MANAGE");
  const id = Number(fd.get("id"));
  const name = String(fd.get("name") ?? "").trim();
  if (!id || !name) return;
  await updateSupplier(id, {
    name,
    availableUSA: on(fd, "availableUSA"),
    availableUK: on(fd, "availableUK"),
    availableEU: on(fd, "availableEU"),
    contact: String(fd.get("contact") ?? "").trim() || undefined,
    active: on(fd, "active"),
  });
  revalidatePath("/settings/logistics");
}

export async function archiveSupplierAction(fd: FormData): Promise<void> {
  await requireModule("settings", "MANAGE");
  const id = Number(fd.get("id"));
  if (!id) return;
  await archiveSupplier(id);
  revalidatePath("/settings/logistics");
}
