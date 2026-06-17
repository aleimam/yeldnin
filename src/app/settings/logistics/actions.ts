"use server";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/access";
import { saveSupplierBatch } from "@/lib/suppliers/suppliers-service";
import { writeAudit } from "@/lib/audit";
import { SLA_CLASSES } from "@/lib/sla/sla-logic";

const on = (fd: FormData, k: string) => fd.get(k) === "on";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const slaCls = (v: string): string | null => ((SLA_CLASSES as readonly string[]).includes(v) ? v : null);

/** Save All for suppliers: parse rows, hand the batch to the service. */
export async function saveSuppliersAction(fd: FormData): Promise<void> {
  const access = await requireCapability("settings", "manageModules");
  const ids = str(fd, "ids").split(",").filter(Boolean).map(Number);

  const rows = ids.map((id) => ({
    id,
    remove: on(fd, `remove_${id}`),
    name: str(fd, `name_${id}`),
    contact: str(fd, `contact_${id}`) || null,
    availableUSA: on(fd, `usa_${id}`),
    availableUK: on(fd, `uk_${id}`),
    availableEU: on(fd, `eu_${id}`),
    active: on(fd, `active_${id}`),
    slaClass: slaCls(str(fd, `slaClass_${id}`)),
  }));

  const newName = str(fd, "new_name");
  const add = newName
    ? {
        name: newName,
        contact: str(fd, "new_contact") || null,
        availableUSA: on(fd, "new_usa"),
        availableUK: on(fd, "new_uk"),
        availableEU: on(fd, "new_eu"),
        slaClass: slaCls(str(fd, "new_slaClass")),
      }
    : null;

  await saveSupplierBatch(rows, add);
  await writeAudit(access.user.id, "settings", "settings.suppliers.save", "supplier", "batch", {
    rows: rows.length,
    added: add ? 1 : 0,
  });
  revalidatePath("/settings/logistics");
}
