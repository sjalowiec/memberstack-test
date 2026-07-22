import { describe, expect, it } from "vitest";
import {
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";
import {
  memberHasActivePaidMembership,
  resolveMembershipCheckoutDecision,
} from "./membershipCheckoutDecision";

function memberWithPlans(
  connections: Array<{ planId: string; status: string; priceId?: string }>,
) {
  return {
    data: {
      id: "mem_test",
      planConnections: connections,
    },
  };
}

describe("resolveMembershipCheckoutDecision", () => {
  it("uses purchase for a free member buying monthly", () => {
    const member = memberWithPlans([]);
    expect(resolveMembershipCheckoutDecision(member, "monthly")).toEqual({
      action: "purchase",
    });
  });

  it("uses purchase for a free member buying annual", () => {
    const member = memberWithPlans([]);
    expect(resolveMembershipCheckoutDecision(member, "annual")).toEqual({
      action: "purchase",
    });
  });

  it("uses purchase for canceled / expired paid connections", () => {
    const member = memberWithPlans([
      {
        planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
        status: "CANCELED",
        priceId: "prc_old",
      },
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "EXPIRED",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "monthly").action).toBe("purchase");
    expect(resolveMembershipCheckoutDecision(member, "annual").action).toBe("purchase");
  });

  it("marks active membership choosing monthly or annual as current", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "monthly")).toEqual({
      action: "current",
    });
    expect(resolveMembershipCheckoutDecision(member, "annual")).toEqual({
      action: "current",
    });
  });

  it("marks trialing membership as current", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "TRIALING",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "annual")).toEqual({
      action: "current",
    });
  });

  it("never returns purchase when any paid membership is active", () => {
    const cases: Array<{
      planId: string;
      planKey: "monthly" | "annual";
    }> = [
      { planId: MEMBERSHIPS.membership.memberstackPlanId, planKey: "monthly" },
      { planId: MEMBERSHIPS.membership.memberstackPlanId, planKey: "annual" },
      { planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId, planKey: "annual" },
      { planId: LEGACY_MEMBERSHIPS.grandfatheredAnnual.memberstackPlanId, planKey: "monthly" },
      {
        planId: LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
        planKey: "monthly",
      },
    ];

    for (const { planId, planKey } of cases) {
      const decision = resolveMembershipCheckoutDecision(
        memberWithPlans([{ planId, status: "ACTIVE" }]),
        planKey,
      );
      expect(decision.action, `${planId} ? ${planKey}`).toBe("current");
    }
  });

  it("does not treat the removed annual Basic plan as current paid membership", () => {
    const member = memberWithPlans([
      {
        planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "monthly")).toEqual({
      action: "purchase",
    });
    expect(memberHasActivePaidMembership(member)).toBe(false);
  });

  it("treats remaining legacy monthly Basic as current paid membership", () => {
    const member = memberWithPlans([
      {
        planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "monthly")).toEqual({
      action: "current",
    });
    expect(memberHasActivePaidMembership(member)).toBe(true);
  });

  it("treats legacy Monthly Subscription plan shell as current", () => {
    const member = memberWithPlans([
      {
        planId: LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "monthly")).toEqual({
      action: "current",
    });
    expect(resolveMembershipCheckoutDecision(member, "annual")).toEqual({
      action: "current",
    });
  });

  it("allows beta-only members to purchase a paid plan", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.beta.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "monthly").action).toBe("purchase");
    expect(memberHasActivePaidMembership(member)).toBe(false);
  });
});
