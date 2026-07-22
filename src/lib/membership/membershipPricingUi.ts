/**
 * Join / membership pricing CTA labels and disabled state from Memberstack plans.
 */

import { memberHasActivePaidMembership } from "./membershipCheckoutDecision";
import type { JoinCheckoutPlanKey } from "./pendingMembershipCheckout";

export type JoinCtaKind = "join" | "current";

export type JoinCtaPresentation = {
  kind: JoinCtaKind;
  label: string;
  disabled: boolean;
};

export function resolveJoinCtaPresentation(
  memberOrPayload: unknown,
  _planKey: JoinCheckoutPlanKey,
): JoinCtaPresentation {
  if (memberHasActivePaidMembership(memberOrPayload)) {
    return {
      kind: "current",
      label: "Current Plan",
      disabled: true,
    };
  }

  return {
    kind: "join",
    label: "Become a Member",
    disabled: false,
  };
}
