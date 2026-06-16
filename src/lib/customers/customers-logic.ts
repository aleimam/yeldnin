// Pure customer logic. No DB/IO.
export const CONTACT_CHANNELS = ["WHATSAPP", "PHONE", "DIRECT", "FACEBOOK", "INSTAGRAM"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export function isContactChannel(v: unknown): v is ContactChannel {
  return typeof v === "string" && (CONTACT_CHANNELS as readonly string[]).includes(v);
}

export function validateCustomer(input: { name?: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!input.name?.trim()) e.name = "Name is required.";
  return e;
}
