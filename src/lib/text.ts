/** Trim a string; empty/whitespace/nullish becomes null. Shared by the
 *  service input-mappers that normalise optional text fields before saving. */
export const clean = (s?: string | null): string | null => s?.trim() || null;
