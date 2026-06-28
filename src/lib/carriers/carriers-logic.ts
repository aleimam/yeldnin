// Pure carrier logic. No DB/IO.
export function validateCarrier(input: { name?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.name?.trim()) e.name = "Name is required.";
  return e;
}
