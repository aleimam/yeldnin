// Pure traveler logic. No DB/IO.
import { isProductType, type ProductType } from "@/lib/products/products-logic";

/** allowedProductTypes is stored as a CSV of ProductType keys. */
export function parseTypes(csv: string | null | undefined): ProductType[] {
  return (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ProductType => isProductType(s));
}
export function joinTypes(types: string[]): string {
  return types.filter((t) => isProductType(t)).join(",");
}

export function validateTraveler(input: { name?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.name?.trim()) e.name = "Name is required.";
  return e;
}
