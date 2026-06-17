// Pure mapping of a parsed spreadsheet row → a product import row. No I/O.
import { isProductType, type ProductType, type Scope } from "./products-logic";

export interface ProductImportRow {
  name: string;
  type: ProductType;
  sku: string | null;
  weightG: number | null;
  size: string | null;
  grade: string | null;
  url: string | null;
  notes: string | null;
}

const defaultType = (scope: Scope): ProductType => (scope === "XOONX" ? "XOONX" : "SUPPLEMENT");

/** Case-insensitive header lookup; first non-empty match, trimmed. */
function pick(row: Record<string, unknown>, ...keys: string[]): string {
  const lower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
  for (const k of keys) {
    const v = lower.get(k.toLowerCase());
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

/** Normalize one raw row to a product (or null when it has no name). Scope comes from context. */
export function normalizeImportRow(row: Record<string, unknown>, scope: Scope): ProductImportRow | null {
  const name = pick(row, "name", "product", "product name");
  if (!name) return null;
  const typeRaw = pick(row, "type").toUpperCase().replace(/\s+/g, "_");
  const weightRaw = pick(row, "weight", "weight (g)", "weightg", "weight_g");
  const weight = Number(weightRaw);
  return {
    name,
    type: isProductType(typeRaw) ? (typeRaw as ProductType) : defaultType(scope),
    sku: pick(row, "sku") || null,
    weightG: weightRaw && !Number.isNaN(weight) ? weight : null,
    size: pick(row, "size") || null,
    grade: pick(row, "grade") || null,
    url: pick(row, "url", "link") || null,
    notes: pick(row, "notes", "note") || null,
  };
}
