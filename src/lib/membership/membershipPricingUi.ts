/**
 * Join / membership pricing CTA labels and disabled state from Memberstack plans.
 */

import {
  memberActivePaidMembershipTier,
  membershipTierFromPlanKey,
  type MembershipCheckoutTier,
} from "./membershipCheckoutDecision";
import type { JoinCheckoutPlanKey } from "./pendingMembershipCheckout";

export type JoinCtaKind =
  | "join-basic"
  | "join-premium"
  | "upgrade-premium"
  | "switch-basic"
  | "current";

export type JoinCtaPresentation = {
  kind: JoinCtaKind;
  label: string;
  disabled: boolean;
};

const DEFAULT_LABEL: Record<MembershipCheckoutTier, string> = {
  basic: "Join Basic",
  premium: "Join Premium",
};

export function resolveJoinCtaPresentation(
  memberOrPayload: unknown,
  planKey: JoinCheckoutPlanKey,
): JoinCtaPresentation {
  const targetTier = membershipTierFromPlanKey(planKey);
  const activeTier = memberActivePaidMembershipTier(memberOrPayload);

  if (!activeTier) {
    return {
      kind: targetTier === "basic" ? "join-basic" : "join-premium",
      label: DEFAULT_LABEL[targetTier],
      disabled: false,
    };
  }

  if (activeTier === targetTier) {
    return {
      kind: "current",
      label: "Current Plan",
      disabled: true,
    };
  }

  if (activeTier === "basic" && targetTier === "premium") {
    return {
      kind: "upgrade-premium",
      label: "Upgrade to Premium",
      disabled: false,
    };
  }

  // Active Premium choosing Basic — update/replace, not a second subscribe.
  return {
    kind: "switch-basic",
    label: "Switch to Basic",
    disabled: false,
  };
}
