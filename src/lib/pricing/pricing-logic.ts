// Pure pricing logic — encodes the Excel formula exactly. No DB/IO.
// All constants/multipliers live in PricingConfig so admin can edit them.
// Verified against the Excel sample sheets in pricing-logic.test.ts.

export type CountryKey = "USA" | "UK" | "EU";
export const SHAPES = [
  "Capsules/Tablets",
  "Softgels/Chews",
  "Powder/Creamy",
  "Gummies",
  "Liquid",
  "Injection",
] as const;
export type Shape = (typeof SHAPES)[number];
export const PACKAGING = ["Plastic", "Glass", "Paper"] as const;
export type Packaging = (typeof PACKAGING)[number];
export const SIZES = ["Small", "Normal", "Big", "Massive"] as const;
export type Size = (typeof SIZES)[number];

export interface PricingConfig {
  fx: number; // USD -> EGP
  // multiplier tables
  country: Record<CountryKey, number>;
  shape: Record<Shape, number>;
  packaging: Record<Packaging, number>;
  size: Record<Size, number>;
  maleSupportMultiplier: number; // applied when male support = true
  // supplement formula constants
  supplement: {
    flatFee: number; // 250
    fxFeeCoef: number; // 10  -> 10*FX
    innerMultiplier: number; // 1.4
    weightFactor: number; // 40 -> W*40*FX/1000
    dosageStep: number; // 31 -> step*(3 - tier)
    margin: number; // 1.2
    roundStep: number; // 10 (round to nearest)
    injectionShape: Shape; // "Injection"
    injectionFee: number; // 2000 (added after, for injections)
    markupFactor: number; // 1.06 -> final markup, then round UP to nearest roundStep
  };
  // device formula constants
  device: {
    base: number; // 2200
    inflation: number; // 1.05 (applied in a few places)
    fxFactor: number; // 1.0825
    perKg: number; // 60
    handling: number; // 1.12
    margin: number; // 1.15
    volumetricDivisor: number; // 5000
    maleSupportMultiplier: number; // 1.2 (device-specific)
    roundStep: number; // 0 => no rounding (matches Excel)
  };
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  fx: 54,
  country: { USA: 1.0, UK: 1.25, EU: 1.1 },
  shape: {
    "Capsules/Tablets": 1.0,
    "Softgels/Chews": 1.0,
    "Powder/Creamy": 1.0,
    Gummies: 1.1,
    Liquid: 1.05,
    Injection: 1.25,
  },
  packaging: { Plastic: 1.0, Glass: 1.12, Paper: 1.06 },
  size: { Small: 0.9, Normal: 1.0, Big: 1.1, Massive: 1.2 },
  maleSupportMultiplier: 1.25,
  supplement: {
    flatFee: 250,
    fxFeeCoef: 10,
    innerMultiplier: 1.4,
    weightFactor: 40,
    dosageStep: 31,
    margin: 1.2,
    roundStep: 10,
    injectionShape: "Injection",
    injectionFee: 2000,
    markupFactor: 1.06,
  },
  device: {
    base: 2200,
    inflation: 1.05,
    fxFactor: 1.0825,
    perKg: 60,
    handling: 1.12,
    margin: 1.15,
    volumetricDivisor: 5000,
    maleSupportMultiplier: 1.2,
    roundStep: 10, // device price rounds UP to the nearest 10
  },
};

/** Round to nearest `step` (Excel ROUND). step<=0 => no rounding. */
export function roundToNearest(value: number, step: number): number {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

/** Round UP to the next `step` (ceiling). step<=0 => no rounding. */
export function roundUpToNearest(value: number, step: number): number {
  if (!step || step <= 0) return value;
  return Math.ceil(value / step) * step;
}

/**
 * Dosage tier T (Excel): blank/zero count or daily-dose => 1; else by days of
 * supply (count / dailyDose): >=90 => 1, >=60 => 2, else 3.
 */
export function dosageTier(count: number, dailyDose: number): 1 | 2 | 3 {
  if (!dailyDose || dailyDose <= 0) return 1;
  if (!count || count <= 0) return 1;
  const days = count / dailyDose;
  if (days >= 90) return 1;
  if (days >= 60) return 2;
  return 3;
}

export interface SupplementInput {
  importedFrom: CountryKey;
  purchasePrice: number; // P
  count: number; // C
  dailyDose: number; // D
  weight: number; // W (grams)
  shape: Shape; // S
  packaging: Packaging; // K
  size: Size; // Z
  maleSupport: boolean; // X
}

export interface SupplementResult {
  price: number;
  totalMultiplier: number;
  tier: 1 | 2 | 3;
}

export function computeSupplementPrice(
  input: SupplementInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): SupplementResult {
  const c = config.supplement;
  const fx = config.fx;
  const O = config.country[input.importedFrom];
  const S = config.shape[input.shape];
  const K = config.packaging[input.packaging];
  const Z = config.size[input.size];
  const X = input.maleSupport ? config.maleSupportMultiplier : 1;
  const M = O * S * K * Z * X;
  const tier = dosageTier(input.count, input.dailyDose);

  const base =
    c.flatFee +
    c.fxFeeCoef * fx +
    c.innerMultiplier *
      (input.purchasePrice * M * fx + (input.weight * c.weightFactor * fx) / 1000) +
    c.dosageStep * (3 - tier);

  let price = roundToNearest(c.margin * base, c.roundStep);
  if (input.shape === c.injectionShape) price += c.injectionFee;
  // Final markup (Excel A-column "Price"): ×markupFactor, rounded UP to nearest 10.
  price = roundUpToNearest(price * c.markupFactor, c.roundStep);

  return { price, totalMultiplier: M, tier };
}

export interface DeviceInput {
  importedFrom: CountryKey;
  purchasePrice: number; // P
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  maleSupport: boolean;
}

export interface DeviceResult {
  price: number;
  chargeableWeight: number;
}

export function computeDevicePrice(
  input: DeviceInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): DeviceResult {
  const d = config.device;
  const fx = config.fx;
  const volumetric =
    (input.lengthCm * input.widthCm * input.heightCm) / d.volumetricDivisor;
  const chargeable = Math.max(volumetric, input.weightKg);
  const maleMul = input.maleSupport ? d.maleSupportMultiplier : 1;

  const internal =
    d.inflation *
    (d.base +
      maleMul *
        d.handling *
        (input.purchasePrice * d.inflation * fx * d.fxFactor +
          chargeable * d.inflation * fx * d.perKg));

  const price = roundUpToNearest(internal * d.margin, d.roundStep);
  return { price, chargeableWeight: chargeable };
}
