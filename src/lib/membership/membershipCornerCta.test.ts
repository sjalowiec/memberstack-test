import { describe, expect, it } from "vitest";
import {
  FREE_ACCESS_MEMBERSHIPS,
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";
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

  it("is false for canceled removed annual Basic (not a paid plan)", () => {
    expect(
      memberHasCanceledPaidMembership(
        memberWithPlans([
          {
            planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
            status: "CANCELED",
            active: false,
          },
        ]),
      ),
    ).toBe(false);
  });

  it("is true for expired membership", () => {
    expect(
      memberHasCanceledPaidMembership(
        memberWithPlans([
          { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "EXPIRED" },
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
          { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
    ).toBe(false);
  });
});

describe("resolveMembershipCornerCta", () => {
  it("logged-out visitor: button shown (Become a Member)", () => {
    expect(resolveMembershipCornerCta({ data: null })).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });

  it("logged-in non-member: button shown (Become a Member)", () => {
    expect(resolveMembershipCornerCta(memberWithPlans([]))).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });

  it("active member: button hidden (paid membership)", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toBeNull();
  });

  it("active member: button hidden (complimentary legacy membership)", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([
          {
            planId: FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
            status: "ACTIVE",
          },
        ]),
      ),
    ).toBeNull();
  });

  it("active remaining legacy monthly Basic: button hidden", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([
          { planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
    ).toBeNull();
  });

  it("legacy Monthly Subscription plan shell: button hidden", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([
          {
            planId: LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
            status: "ACTIVE",
          },
        ]),
      ),
    ).toBeNull();
  });

  it("beta-only does not grant access → Become a Member", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });

  it("active removed annual Basic does not grant access → Become a Member", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });

  it("canceled paid history does not Restart while restart is disabled", () => {
    expect(MEMBERSHIP_CORNER_RESTART_ENABLED).toBe(false);
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([
          {
            planId: MEMBERSHIPS.membership.memberstackPlanId,
            status: "CANCELED",
            active: false,
          },
        ]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });
});
