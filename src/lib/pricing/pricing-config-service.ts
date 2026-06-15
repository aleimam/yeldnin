import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "./pricing-logic";

/** Merge a stored config over defaults so new keys are always present. */
function withDefaults(partial: Partial<PricingConfig> | null): PricingConfig {
  const d = DEFAULT_PRICING_CONFIG;
  if (!partial) return d;
  return {
    fx: partial.fx ?? d.fx,
    country: { ...d.country, ...partial.country },
    shape: { ...d.shape, ...partial.shape },
    packaging: { ...d.packaging, ...partial.packaging },
    size: { ...d.size, ...partial.size },
    maleSupportMultiplier:
      partial.maleSupportMultiplier ?? d.maleSupportMultiplier,
    supplement: { ...d.supplement, ...partial.supplement },
    device: { ...d.device, ...partial.device },
  };
}

/** Read the active pricing config (memoized per request), seeding defaults. */
export const getPricingConfig = cache(async (): Promise<PricingConfig> => {
  const row = await prisma.pricingSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    await prisma.pricingSettings.create({
      data: { id: 1, config: JSON.stringify(DEFAULT_PRICING_CONFIG) },
    });
    return DEFAULT_PRICING_CONFIG;
  }
  try {
    return withDefaults(JSON.parse(row.config) as Partial<PricingConfig>);
  } catch {
    return DEFAULT_PRICING_CONFIG;
  }
});

export async function savePricingConfig(config: PricingConfig): Promise<void> {
  await prisma.pricingSettings.upsert({
    where: { id: 1 },
    update: { config: JSON.stringify(config) },
    create: { id: 1, config: JSON.stringify(config) },
  });
}
