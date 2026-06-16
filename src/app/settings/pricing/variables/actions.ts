"use server";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { SHAPES, PACKAGING, SIZES, type PricingConfig } from "@/lib/pricing/pricing-logic";
import { getPricingConfig, savePricingConfig } from "@/lib/pricing/pricing-config-service";
import { writeAudit } from "@/lib/audit";

export interface FormState {
  error?: string;
  ok?: boolean;
}

export async function saveVariablesAction(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const access = await requireModule("egv_pricer", "MANAGE");
  const cur = await getPricingConfig();

  const num = (name: string, fallback: number): number => {
    const v = fd.get(name);
    if (v === null || String(v).trim() === "") return fallback;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : fallback;
  };

  const next: PricingConfig = {
    fx: num("fx", cur.fx),
    country: {
      USA: num("country.USA", cur.country.USA),
      UK: num("country.UK", cur.country.UK),
      EU: num("country.EU", cur.country.EU),
    },
    shape: Object.fromEntries(
      SHAPES.map((s) => [s, num(`shape.${s}`, cur.shape[s])]),
    ) as PricingConfig["shape"],
    packaging: Object.fromEntries(
      PACKAGING.map((p) => [p, num(`packaging.${p}`, cur.packaging[p])]),
    ) as PricingConfig["packaging"],
    size: Object.fromEntries(
      SIZES.map((z) => [z, num(`size.${z}`, cur.size[z])]),
    ) as PricingConfig["size"],
    maleSupportMultiplier: num("maleSupportMultiplier", cur.maleSupportMultiplier),
    supplement: {
      flatFee: num("supplement.flatFee", cur.supplement.flatFee),
      fxFeeCoef: num("supplement.fxFeeCoef", cur.supplement.fxFeeCoef),
      innerMultiplier: num("supplement.innerMultiplier", cur.supplement.innerMultiplier),
      weightFactor: num("supplement.weightFactor", cur.supplement.weightFactor),
      dosageStep: num("supplement.dosageStep", cur.supplement.dosageStep),
      margin: num("supplement.margin", cur.supplement.margin),
      roundStep: num("supplement.roundStep", cur.supplement.roundStep),
      injectionShape: cur.supplement.injectionShape,
      injectionFee: num("supplement.injectionFee", cur.supplement.injectionFee),
    },
    device: {
      base: num("device.base", cur.device.base),
      inflation: num("device.inflation", cur.device.inflation),
      fxFactor: num("device.fxFactor", cur.device.fxFactor),
      perKg: num("device.perKg", cur.device.perKg),
      handling: num("device.handling", cur.device.handling),
      margin: num("device.margin", cur.device.margin),
      volumetricDivisor: num("device.volumetricDivisor", cur.device.volumetricDivisor),
      maleSupportMultiplier: num("device.maleSupportMultiplier", cur.device.maleSupportMultiplier),
      roundStep: num("device.roundStep", cur.device.roundStep),
    },
  };

  await savePricingConfig(next);
  await writeAudit(access.user.id, "egv_pricer", "pricing.variables.update", "pricingSettings", 1, { fx: next.fx });
  revalidatePath("/settings/pricing/variables");
  return { ok: true };
}
