/**
 * Decide whether the free Hat Pattern should ask for email, silently tag a
 * known Memberstack email, or continue to the finished pattern.
 *
 * Based on whether we already know/captured their email — not membership plan.
 */

export type HatPatternLeadCaptureDecision =
  | { action: "continue" }
  | { action: "submit-known-email"; email: string; firstName?: string }
  | { action: "show-capture" };

export function decideHatPatternLeadCapture(args: {
  alreadyCaptured: boolean;
  memberEmail?: string | null;
  memberFirstName?: string | null;
}): HatPatternLeadCaptureDecision {
  if (args.alreadyCaptured) {
    return { action: "continue" };
  }

  const email = typeof args.memberEmail === "string" ? args.memberEmail.trim() : "";
  if (email) {
    const firstName =
      typeof args.memberFirstName === "string" ? args.memberFirstName.trim() : "";
    return firstName
      ? { action: "submit-known-email", email, firstName }
      : { action: "submit-known-email", email };
  }

  return { action: "show-capture" };
}
