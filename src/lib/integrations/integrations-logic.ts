// Pure integration helpers. No DB/IO. Unit-tested.

export const INBOUND_KEY_PREFIX = "veeey_";

/** A base URL must be a syntactically valid http(s) URL. */
export function isValidBaseUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** A short, non-revealing display hint for an issued API key (prefix + a few chars). */
export function keyHint(key: string): string {
  return `${key.slice(0, INBOUND_KEY_PREFIX.length + 4)}…`;
}
