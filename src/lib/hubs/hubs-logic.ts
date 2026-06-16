// Pure hub logic. No DB/IO.
export const COUNTRIES = ["USA", "UK", "EU"] as const;
export type Country = (typeof COUNTRIES)[number];

export function isCountry(v: unknown): v is Country {
  return typeof v === "string" && (COUNTRIES as readonly string[]).includes(v);
}

export function validateHub(input: { name?: string; country?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.name?.trim()) e.name = "Name is required.";
  if (!isCountry(input.country ?? "")) e.country = "A valid country is required.";
  return e;
}
