import "server-only";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { sortTiers, type BonusTier } from "./cs-logic";
import { listRepOptions } from "./cs-eval-service";

/** Starter tiers shown before any are saved (the manager extends these). */
const DEFAULT_TIERS: BonusTier[] = [
  { fromPct: 0, bonusPct: 0 },
  { fromPct: 76, bonusPct: 5 },
];

export interface RepBonusRow {
  id: number;
  name: string;
  maxBonus: number; // EGP
}

/** Active sales reps with their max monthly bonus (EGP); 0 when unset. */
export async function listRepBonuses(): Promise<RepBonusRow[]> {
  const [reps, bonuses] = await Promise.all([listRepOptions(), prisma.csRepBonus.findMany()]);
  const map = new Map(bonuses.map((b) => [b.userId, b.maxBonus]));
  return reps.map((r) => ({ id: r.id, name: r.name, maxBonus: map.get(r.id) ?? 0 }));
}

export async function saveRepBonuses(rows: { userId: number; maxBonus: number }[], userId: number): Promise<void> {
  const clean = rows.map((r) => ({ userId: r.userId, maxBonus: Math.max(0, Math.round(r.maxBonus || 0)) }));
  if (clean.length) {
    await prisma.$transaction(clean.map((r) => prisma.csRepBonus.upsert({ where: { userId: r.userId }, create: r, update: { maxBonus: r.maxBonus } })));
  }
  await writeAudit(userId, "cs_quality", "bonus.maxSave", "csRepBonus", 0, {});
}

/** Bonus tiers (ascending thresholds); the starter set until first saved. */
export async function getBonusTiers(): Promise<BonusTier[]> {
  const rows = await prisma.csBonusTier.findMany({ orderBy: { fromPct: "asc" } });
  return rows.length ? rows.map((r) => ({ fromPct: r.fromPct, bonusPct: r.bonusPct })) : DEFAULT_TIERS;
}

export async function saveBonusTiers(tiers: BonusTier[], userId: number): Promise<void> {
  const clean = sortTiers(tiers.filter((t) => Number.isFinite(t.fromPct) && Number.isFinite(t.bonusPct)));
  await prisma.$transaction([
    prisma.csBonusTier.deleteMany({}),
    ...clean.map((t, i) => prisma.csBonusTier.create({ data: { fromPct: t.fromPct, bonusPct: t.bonusPct, sortOrder: i } })),
  ]);
  await writeAudit(userId, "cs_quality", "bonus.tiersSave", "csBonusTier", 0, {});
}

/** One rep's max bonus (EGP), 0 when unset. */
export async function getRepBonus(userId: number): Promise<number> {
  const b = await prisma.csRepBonus.findUnique({ where: { userId } });
  return b?.maxBonus ?? 0;
}

/** userId → max bonus, for the analytics leaderboard. */
export async function repBonusMap(): Promise<Map<number, number>> {
  const bonuses = await prisma.csRepBonus.findMany();
  return new Map(bonuses.map((b) => [b.userId, b.maxBonus]));
}
