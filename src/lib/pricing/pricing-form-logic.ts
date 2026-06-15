// Pure parsing/validation of raw calculator form values into typed engine
// inputs. Returns field-level errors for red-highlighting. Unit-tested.

import {
  SHAPES,
  PACKAGING,
  SIZES,
  type SupplementInput,
  type DeviceInput,
  type CountryKey,
  type Shape,
  type Packaging,
  type Size,
} from "./pricing-logic";

export type FieldErrors = Record<string, string>;
export type Parsed<T> =
  | { ok: true; input: T }
  | { ok: false; fieldErrors: FieldErrors };

const COUNTRIES: CountryKey[] = ["USA", "UK", "EU"];

function posNum(
  raw: unknown,
  field: string,
  errors: FieldErrors,
): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").trim());
  if (!Number.isFinite(n)) {
    errors[field] = "Required.";
    return NaN;
  }
  if (n <= 0) {
    errors[field] = "Must be greater than 0.";
    return NaN;
  }
  return n;
}

function inEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  field: string,
  errors: FieldErrors,
): T {
  const v = String(raw ?? "").trim();
  if (!allowed.includes(v as T)) {
    errors[field] = "Select a valid option.";
    return allowed[0];
  }
  return v as T;
}

function asBool(raw: unknown): boolean {
  return raw === true || raw === "true" || raw === "on" || raw === "1";
}

export function parseSupplementForm(
  raw: Record<string, unknown>,
): Parsed<SupplementInput> {
  const errors: FieldErrors = {};
  const importedFrom = inEnum(raw.importedFrom, COUNTRIES, "importedFrom", errors);
  const purchasePrice = posNum(raw.purchasePrice, "purchasePrice", errors);
  const count = posNum(raw.count, "count", errors);
  const dailyDose = posNum(raw.dailyDose, "dailyDose", errors);
  const weight = posNum(raw.weight, "weight", errors);
  const shape = inEnum<Shape>(raw.shape, SHAPES, "shape", errors);
  const packaging = inEnum<Packaging>(raw.packaging, PACKAGING, "packaging", errors);
  const size = inEnum<Size>(raw.size, SIZES, "size", errors);

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    input: {
      importedFrom,
      purchasePrice,
      count,
      dailyDose,
      weight,
      shape,
      packaging,
      size,
      maleSupport: asBool(raw.maleSupport),
    },
  };
}

export function parseDeviceForm(
  raw: Record<string, unknown>,
): Parsed<DeviceInput> {
  const errors: FieldErrors = {};
  const importedFrom = inEnum(raw.importedFrom, COUNTRIES, "importedFrom", errors);
  const purchasePrice = posNum(raw.purchasePrice, "purchasePrice", errors);
  const lengthCm = posNum(raw.lengthCm, "lengthCm", errors);
  const widthCm = posNum(raw.widthCm, "widthCm", errors);
  const heightCm = posNum(raw.heightCm, "heightCm", errors);
  const weightKg = posNum(raw.weightKg, "weightKg", errors);

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    input: {
      importedFrom,
      purchasePrice,
      lengthCm,
      widthCm,
      heightCm,
      weightKg,
      maleSupport: asBool(raw.maleSupport),
    },
  };
}
