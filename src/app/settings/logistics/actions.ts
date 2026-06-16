"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/auth/access";

const on = (fd: FormData, k: string) => fd.get(k) === "on";

/** Save All for suppliers: batch-update every row + archive + add a new one. */
export async function saveSuppliersAction(fd: FormData): Promise<void> {
  await requireModule("settings", "MANAGE");
  const ids = String(fd.get("ids") ?? "").split(",").filter(Boolean).map(Number);
  const ops = [];

  for (const id of ids) {
    if (on(fd, `remove_${id}`)) {
      ops.push(prisma.supplier.update({ where: { id }, data: { archivedAt: new Date() } }));
      continue;
    }
    const name = String(fd.get(`name_${id}`) ?? "").trim();
    if (!name) continue;
    ops.push(
      prisma.supplier.update({
        where: { id },
        data: {
          name,
          contact: String(fd.get(`contact_${id}`) ?? "").trim() || null,
          availableUSA: on(fd, `usa_${id}`),
          availableUK: on(fd, `uk_${id}`),
          availableEU: on(fd, `eu_${id}`),
          active: on(fd, `active_${id}`),
        },
      }),
    );
  }

  const newName = String(fd.get("new_name") ?? "").trim();
  if (newName) {
    ops.push(
      prisma.supplier.create({
        data: {
          name: newName,
          contact: String(fd.get("new_contact") ?? "").trim() || null,
          availableUSA: on(fd, "new_usa"),
          availableUK: on(fd, "new_uk"),
          availableEU: on(fd, "new_eu"),
        },
      }),
    );
  }

  if (ops.length) await prisma.$transaction(ops);
  revalidatePath("/settings/logistics");
}
