import { describe, expect, it } from "vitest";
import { LEGACY_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import {
  MEMBERSHIP_CORNER_CTA,
  MEMBERSHIP_CORNER_RESTART_ENABLED,
  memberHasCanceledPaidMembership,
  resolveMembershipCornerCta,
} from "./membershipCornerCta";

function memberWithPlans(
  connections: Array<{ planId: string; status: string; active?: boolean }>,
) {
  return {
    data: {
      id: "mem_test",
      planConnections: connections,
    },
  };
}

describe("memberHasCanceledPaidMembership", () => {
  it("is false when logged out", () => {
    expect(memberHasCanceledPaidMembership({ data: null })).toBe(false);
  });

  it("is false for empty planConnections (never paid)", () => {
    expect(memberHasCanceledPaidMembership(memberWithPlans([]))).toBe(false);
  });

  it("is false for beta-only", () => {
    expect(
      memberHasCanceledPaidMembership(
        memberWithPlans([{ planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toBe(false);
  });

  it("is true for canceled Basic", () => {
    expect(
      memberHasCanceledPaidMembership(
        memberWithPlans([
          { planId: MEMBERSHIPS.basic.memberstackPlanId, status: "CANCELED", active: false },
        ]),
      ),
    ).toBe(true);
  });

  it("is true for expired Premium", () => {
    expect(
      memberHasCanceledPaidMembership(
        memberWithPlans([
          { planId: MEMBERSHIPS.premium.memberstackPlanId, status: "EXPIRED" },
        ]),
      ),
    ).toBe(true);
  });

  it("is true for canceled legacy paid plans", () => {
    expect(
      memberHasCanceledPaidMembership(
        memberWithPlans([
          {
            planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
            status: "CANCELLED",
          },
        ]),
      ),
    ).toBe(true);
  });

  it("is false when paid plan is still active", () => {
    expect(
      memberHasCanceledPaidMembership(
        memberWithPlans([
          { planId: MEMBERSHIPS.basic.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
    ).toBe(false);
  });
});

describe("resolveMembershipCornerCta", () => {
  it("logged out ? Become a Member ? /membership", () => {
    expect(resolveMembershipCornerCta({ data: null })).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });

  it("logged in with no plans ? Become a Member", () => {
    expect(resolveMembershipCornerCta(memberWithPlans([]))).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });

  it("beta-only ? Become a Member", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });

  it("active Basic ? Upgrade to Premium ? /membership", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: MEMBERSHIPS.basic.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.upgrade);
  });

  it("active Premium ? Manage Membership ? /account#membership", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: MEMBERSHIPS.premium.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.manage);
  });

  it("legacy Monthly Subscription plan shell ? Manage Membership", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([
          {
            planId: LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
            status: "ACTIVE",
          },
        ]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.manage);
  });

  it("Premium wins over Basic when both active", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([
          { planId: MEMBERSHIPS.basic.memberstackPlanId, status: "ACTIVE" },
          { planId: MEMBERSHIPS.premium.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.manage);
  });

  it("canceled paid history does not Restart while restart is disabled", () => {
    expect(MEMBERSHIP_CORNER_RESTART_ENABLED).toBe(false);
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([
          { planId: MEMBERSHIPS.basic.memberstackPlanId, status: "CANCELED", active: false },
        ]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });
});
