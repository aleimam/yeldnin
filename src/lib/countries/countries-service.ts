import "server-only";
import { prisma } from "@/lib/db";

/** All countries (admin view includes disabled). */
export function listCountries(includeDisabled = false) {
  return prisma.country.findMany({
    where: { archivedAt: null, ...(includeDisabled ? {} : { enabled: true }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Enabled country names for the Trip / Hub / Purchase pickers. */
export async function listCountryOptions(): Promise<string[]> {
  const rows = await listCountries(false);
  return rows.map((c) => c.name);
}

export interface CountryRow {
  id: number;
  remove: boolean;
  name: string;
  enabled: boolean;
}

/** "Save all" batch: update/soft-delete existing + optionally add one (re-adding a removed name un-archives it). */
export async function saveCountryBatch(rows: CountryRow[], add: { name: string } | null) {
  const ops = [];
  for (const r of rows) {
    if (r.remove) {
      ops.push(prisma.country.update({ where: { id: r.id }, data: { archivedAt: new Date() } }));
    } else if (r.name) {
      ops.push(prisma.country.update({ where: { id: r.id }, data: { name: r.name, enabled: r.enabled } }));
    }
  }
  if (add?.name) {
    ops.push(
      prisma.country.upsert({
        where: { name: add.name },
        update: { archivedAt: null, enabled: true },
        create: { name: add.name },
      }),
    );
  }
  if (ops.length) await prisma.$transaction(ops);
}

/** Soft-delete a single country (kept in records via archivedAt). */
export async function deleteCountry(id: number) {
  await prisma.country.update({ where: { id }, data: { archivedAt: new Date() } });
}
