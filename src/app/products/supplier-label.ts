/** "Amazon (US/UK/EU)" — supplier name plus its available countries. */
export function supplierLabel(s: {
  name: string;
  availableUSA: boolean;
  availableUK: boolean;
  availableEU: boolean;
}): string {
  const c = [s.availableUSA && "US", s.availableUK && "UK", s.availableEU && "EU"].filter(Boolean).join("/");
  return c ? `${s.name} (${c})` : s.name;
}
