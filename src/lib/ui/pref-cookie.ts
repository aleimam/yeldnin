/**
 * Write a first-party UI preference cookie (locale, theme, sidebar, …) from the
 * client. Adds `SameSite=Lax` (not sent on cross-site requests) and `Secure` on
 * HTTPS. These values are non-sensitive and re-validated server-side, but the
 * flags are good hygiene. Default lifetime: 1 year.
 */
export function writePrefCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 365): void {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}
