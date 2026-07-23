import "server-only";
import { prisma } from "@/lib/db";
import { normalizeEdge } from "./weighting-logic";

/** Every connection edge as `[aId, bId]` (aId < bId) — feeds the graph. */
export async function allTeamEdges(): Promise<Array<[number, number]>> {
  const rows = await prisma.teamConnection.findMany({ select: { aId: true, bId: true } });
  return rows.map((r) => [r.aId, r.bId] as [number, number]);
}

/** The team ids directly connected to `teamId` (either direction). */
export async function connectedTeamIds(teamId: number): Promise<number[]> {
  const rows = await prisma.teamConnection.findMany({
    where: { OR: [{ aId: teamId }, { bId: teamId }] },
    select: { aId: true, bId: true },
  });
  return rows.map((r) => (r.aId === teamId ? r.bId : r.aId));
}

/** Replace a team's direct connections with `ids` — reciprocal + undirected
 *  (adding B to A means A appears in B's list too). Ignores self and dupes. */
export async function setTeamConnections(teamId: number, ids: number[]): Promise<void> {
  const wanted = [...new Set(ids.filter((x) => Number.isInteger(x) && x !== teamId))];
  const edges = wanted.map((other) => normalizeEdge(teamId, other));
  await prisma.$transaction(async (tx) => {
    await tx.teamConnection.deleteMany({ where: { OR: [{ aId: teamId }, { bId: teamId }] } });
    if (edges.length) {
      await tx.teamConnection.createMany({ data: edges.map(([a, b]) => ({ aId: a, bId: b })) });
    }
  });
}
