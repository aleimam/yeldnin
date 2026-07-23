import { getAccess } from "@/lib/auth/access";
import { csvLongForm } from "@/lib/evaluation/eval-analytics-service";

export async function GET(_req: Request, { params }: { params: Promise<{ cycle: string }> }) {
  const access = await getAccess();
  if (!access.can("evaluation", "manage")) return new Response("Forbidden", { status: 403 });
  const { cycle } = await params;
  const id = Number(cycle);
  if (!Number.isInteger(id)) return new Response("Bad request", { status: 400 });
  const csv = await csvLongForm(id);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="360-cycle-${id}.csv"`,
    },
  });
}
