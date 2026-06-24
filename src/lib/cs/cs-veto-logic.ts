// Pure CS Quality "veto" logic. No DB/IO. Unit-tested.
//
// A rep may dispute ("veto") an APPROVED evaluation of themselves, up to a
// monthly allowance. Every cast veto counts against the allowance regardless of
// outcome. A veto returns the eval to an admin who either REJECTS the veto (keeps
// the eval) or UPHELDs it (soft-deletes the eval). The eval keeps counting toward
// the rep's score until the admin acts.

export const VETO_STATUSES = ["PENDING", "REJECTED", "UPHELD"] as const;
export type VetoStatus = (typeof VETO_STATUSES)[number];
export function isVetoStatus(v: unknown): v is VetoStatus {
  return typeof v === "string" && (VETO_STATUSES as readonly string[]).includes(v);
}

export interface VetoQuota {
  allowance: number;
  used: number;
  remaining: number;
}

/** A rep's monthly veto quota — every cast veto counts (no refunds). */
export function vetoQuota(allowance: number, usedThisMonth: number): VetoQuota {
  const used = Math.max(0, usedThisMonth);
  return { allowance, used, remaining: Math.max(0, allowance - used) };
}

/**
 * Can this rep veto this evaluation right now? Only the subject, only an
 * APPROVED eval, not already vetoed, and with quota left.
 */
export function canCastVeto(opts: {
  isSubject: boolean;
  evalStatus: string;
  alreadyVetoed: boolean;
  remaining: number;
}): boolean {
  return opts.isSubject && opts.evalStatus === "APPROVED" && !opts.alreadyVetoed && opts.remaining > 0;
}
