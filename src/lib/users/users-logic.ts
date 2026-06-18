// Pure user-name helpers. No DB/IO.

export interface NameParts {
  name: string;
  nameAr?: string | null;
}

/** A user's display name for the active locale — Arabic falls back to the base
 *  display name when the Arabic one is blank. */
export function displayName(u: NameParts, locale: string): string {
  return locale === "ar" && u.nameAr ? u.nameAr : u.name;
}
