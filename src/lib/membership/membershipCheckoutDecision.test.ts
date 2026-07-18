import { describe, expect, it } from "vitest";
import { LEGACY_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import { resolveMembershipCheckoutDecision } from "./membershipCheckoutDecision";

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
  it("uses purchase for a free member buying Basic", () => {
    const member = memberWithPlans([]);
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly")).toEqual({
      action: "purchase",
    });
  });

  it("uses purchase for a free member buying Premium", () => {
    const member = memberWithPlans([]);
    expect(resolveMembershipCheckoutDecision(member, "premiumAnnual")).toEqual({
      action: "purchase",
    });
  });

  it("uses purchase for canceled / expired paid connections", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "CANCELED",
        priceId: "prc_old",
      },
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "EXPIRED",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly").action).toBe("purchase");
    expect(resolveMembershipCheckoutDecision(member, "premiumAnnual").action).toBe("purchase");
  });

  it("marks active Basic choosing Basic as current (not purchase)", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "basicAnnual")).toEqual({
      action: "current",
      tier: "basic",
    });
  });

  it("uses update for active Basic choosing Premium", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "premiumMonthly")).toEqual({
      action: "update",
    });
  });

  it("marks active Premium choosing Premium as current (not purchase)", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "TRIALING",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "premiumAnnual")).toEqual({
      action: "current",
      tier: "premium",
    });
  });

  it("uses update for active Premium choosing Basic (never a second subscription)", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly")).toEqual({
      action: "update",
    });
  });

  it("never returns purchase when any paid Basic/Premium membership is active", () => {
    const cases: Array<{
      planId: string;
      planKey: "basicMonthly" | "basicAnnual" | "premiumMonthly" | "premiumAnnual";
    }> = [
      { planId: MEMBERSHIPS.basic.memberstackPlanId, planKey: "basicMonthly" },
      { planId: MEMBERSHIPS.basic.memberstackPlanId, planKey: "premiumMonthly" },
      { planId: MEMBERSHIPS.premium.memberstackPlanId, planKey: "premiumAnnual" },
      { planId: MEMBERSHIPS.premium.memberstackPlanId, planKey: "basicAnnual" },
      { planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId, planKey: "premiumAnnual" },
      {
        planId: LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
        planKey: "basicMonthly",
      },
    ];

    for (const { planId, planKey } of cases) {
      const decision = resolveMembershipCheckoutDecision(
        memberWithPlans([{ planId, status: "ACTIVE" }]),
        planKey,
      );
      expect(decision.action, `${planId} ? ${planKey}`).not.toBe("purchase");
    }
  });

  it("treats legacy Basic as Basic current / Premium update", () => {
    const member = memberWithPlans([
      {
        planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly")).toEqual({
      action: "current",
      tier: "basic",
    });
    expect(resolveMembershipCheckoutDecision(member, "premiumMonthly")).toEqual({
      action: "update",
    });
  });

  it("treats legacy Monthly Subscription plan shell as Premium", () => {
    const member = memberWithPlans([
      {
        planId: LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "premiumMonthly")).toEqual({
      action: "current",
      tier: "premium",
    });
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly")).toEqual({
      action: "update",
    });
  });

  it("allows beta-only members to purchase a paid plan", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.beta.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly").action).toBe("purchase");
  });
});
