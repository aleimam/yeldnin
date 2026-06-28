// Pure helpers for global search. No Prisma/I/O — the service does the queries.

export type SearchKind = "uid" | "text";

export interface ParsedQuery {
  kind: SearchKind;
  /** Trimmed raw text (for text matching / display). */
  text: string;
  /** Upper-cased UID when the query looks like one (e.g. "itm2606001"), else null. */
  uid: string | null;
}

// A UID is 2–4 letters then 3+ digits (ITM2606001, ISS2606003, …).
const UID_RE = /^[A-Za-z]{2,4}\d{3,}$/;

export function parseQuery(raw: string): ParsedQuery {
  const text = raw.trim();
  if (UID_RE.test(text)) return { kind: "uid", text, uid: text.toUpperCase() };
  return { kind: "text", text, uid: null };
}

/** Minimum length before we run a search (avoids matching everything). */
export function isSearchable(raw: string): boolean {
  return raw.trim().length >= 2;
}

// UID prefix → entity type, for reference/ranking.
export const UID_PREFIX_TYPE: Record<string, string> = {
  ITM: "item",
  REQ: "request",
  PUR: "purchase",
  PAT: "patch",
  TRP: "trip",
  SHP: "shipment",
  ISS: "issue",
  PRD: "product",
  CUS: "customer",
  TRV: "traveler",
  HUB: "hub",
  CUR: "courier",
  CAR: "carrier",
};

/** The 3-letter prefix of a UID (e.g. "ITM"), or null. */
export function uidPrefix(uid: string): string | null {
  const m = uid.match(/^([A-Za-z]{2,4})\d/);
  return m ? m[1].toUpperCase() : null;
}
