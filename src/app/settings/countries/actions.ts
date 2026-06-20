"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { saveCountryBatch, deleteCountry } from "@/lib/countries/countries-service";
import { writeAudit } from "@/lib/audit";
import { saved, saveError, type SaveState } from "@/lib/forms/action-state";

const on = (fd: FormData, k: string) => fd.get(k) === "on";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const idList = (fd: FormData) => str(fd, "ids").split(",").filter(Boolean).map(Number);

/** Save All for the managed country list. */
export async function saveCountriesAction(prev: SaveState, fd: FormData): Promise<SaveState> {
  const access = await requireCapability("settings", "manageModules");
  const rows = idList(fd).map((id) => ({
    id,
    remove: on(fd, `remove_${id}`),
    name: str(fd, `name_${id}`),
    enabled: on(fd, `enabled_${id}`),
  }));
  const newName = str(fd, "new_name");
  try {
    await saveCountryBatch(rows, newName ? { name: newName } : null);
    await writeAudit(access.user.id, "settings", "settings.countries.save", "country", "batch", { rows: rows.length });
    revalidatePath("/settings/countries");
    return saved(prev);
  } catch {
    return saveError(prev);
  }
}

/** Soft-delete a single country. */
export async function deleteCountryAction(id: number): Promise<void> {
  const access = await requireCapability("settings", "manageModules");
  await deleteCountry(id);
  await writeAudit(access.user.id, "settings", "settings.country.delete", "country", id);
  revalidatePath("/settings/countries");
}
