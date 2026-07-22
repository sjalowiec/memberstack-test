/**
 * Primary sales-page CTA on /membership (hero "Choose a membership").
 *
 * Prospects and free accounts scroll to the monthly/annual purchase choices.
 * Active paid members are sent to manage billing — never into a login/signup modal.
 */

import { memberHasActivePaidMembership } from "./membershipCheckoutDecision";

export type MembershipSalesCtaKind = "choose-plan" | "manage";

export type MembershipSalesCta = {
  kind: MembershipSalesCtaKind;
  label: string;
  href: string;
};

export const MEMBERSHIP_SALES_PRICING_HASH = "#pricing";
export const MEMBERSHIP_SALES_MANAGE_HREF = "/account#membership";

export const MEMBERSHIP_SALES_CTA = {
  choosePlan: {
    kind: "choose-plan",
    label: "Choose a membership",
    href: MEMBERSHIP_SALES_PRICING_HASH,
  },
  manage: {
    kind: "manage",
    label: "Manage Membership",
    href: MEMBERSHIP_SALES_MANAGE_HREF,
  },
} as const satisfies Record<"choosePlan" | "manage", MembershipSalesCta>;

/**
 * Resolve the hero sales CTA from the current Memberstack member payload.
 * Logged-out, free, beta-only, and canceled members all choose a plan first.
 */
export function resolveMembershipSalesCta(memberOrPayload: unknown): MembershipSalesCta {
  if (memberHasActivePaidMembership(memberOrPayload)) {
    return { ...MEMBERSHIP_SALES_CTA.manage };
  }
  return { ...MEMBERSHIP_SALES_CTA.choosePlan };
}
