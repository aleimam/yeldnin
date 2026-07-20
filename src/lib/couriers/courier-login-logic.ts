// Pure logic for courier phone+PIN login. No DB/IO. Unit-tested.
//
// Couriers are THIRD_PARTY users who sign in with a PHONE (stored in
// User.username) and a PIN (bcrypt-hashed like any password). See
// INTEGRATION_V2_DELIVERIES.md §5. The phone is NOT a secret — it's on every
// contact list — so the PIN is the whole factor, backed by the login route's
// per-account lockout.

/**
 * Canonicalise an Egyptian mobile number so the SAME phone typed three
 * different ways (`+20 100…`, `00201 00…`, `0100 123 4567`) resolves to ONE
 * stored value and matches at login. Returns the 11-digit local form
 * (`01XXXXXXXXX`), or null when the input isn't phone-shaped — in which case the
 * caller treats it as a plain username, not a phone.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, ""); // digits only — drops +, spaces, dashes, parens
  if (!d) return null;
  d = d.replace(/^00/, ""); // international 00 prefix
  if (d.startsWith("20") && d.length === 12) d = "0" + d.slice(2); // 20 1XXXXXXXXX → 01XXXXXXXXX
  // Egyptian mobiles are 11 digits starting 010/011/012/015.
  if (/^01[0125]\d{8}$/.test(d)) return d;
  return null;
}

/** True when a login identifier is a valid Egyptian mobile (so login should
 *  also try to match it as a phone). */
export function isPhoneIdentifier(identifier: string): boolean {
  return normalizePhone(identifier) != null;
}

export const PIN_MIN = 4;
export const PIN_MAX = 6;

/** True for `0123`, `456`, `98765`, etc. — one contiguous run up or down. */
function isSequential(pin: string): boolean {
  let up = true;
  let down = true;
  for (let i = 1; i < pin.length; i++) {
    const diff = pin.charCodeAt(i) - pin.charCodeAt(i - 1);
    if (diff !== 1) up = false;
    if (diff !== -1) down = false;
  }
  return up || down;
}

/**
 * PIN policy: 4–6 digits, not all-identical, not a plain sequence. Returns an
 * error message or null. Deliberately numeric-only (couriers key it on a phone),
 * which is why courier accounts must NOT go through the letter+digit+symbol
 * password policy.
 */
export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return "PIN must be digits only.";
  if (pin.length < PIN_MIN || pin.length > PIN_MAX) return `PIN must be ${PIN_MIN}–${PIN_MAX} digits.`;
  if (/^(\d)\1+$/.test(pin)) return "PIN can't be all the same digit.";
  if (isSequential(pin)) return "PIN can't be a simple sequence.";
  return null;
}

/**
 * The synthetic, unique email a courier User carries. User.email is non-null and
 * unique in the schema, but a courier logs in by phone and may have no real
 * mailbox — so we mint an internal address that never receives mail and can't
 * collide with a real one (the .invalid TLD is reserved by RFC 2606).
 */
export function courierEmail(canonicalPhone: string): string {
  return `courier.${canonicalPhone}@yeldn.invalid`;
}
