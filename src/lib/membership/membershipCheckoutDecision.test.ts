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
  it("allows a logged-in member with no active paid plan", () => {
    const member = memberWithPlans([]);
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly").action).toBe("allow");
    expect(resolveMembershipCheckoutDecision(member, "premiumAnnual").action).toBe("allow");
  });

  it("allows a canceled member to restart (non-active connections ignored)", () => {
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
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly").action).toBe("allow");
    expect(resolveMembershipCheckoutDecision(member, "premiumAnnual").action).toBe("allow");
  });

  it("blocks active Basic from buying Basic again", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    const decision = resolveMembershipCheckoutDecision(member, "basicAnnual");
    expect(decision).toMatchObject({ action: "manage", reason: "basic-rebuy" });
  });

  it("allows active Basic to buy Premium (upgrade path)", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "premiumMonthly").action).toBe("allow");
  });

  it("blocks active Premium from starting another Premium checkout", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "TRIALING",
      },
    ]);
    const decision = resolveMembershipCheckoutDecision(member, "premiumAnnual");
    expect(decision).toMatchObject({ action: "manage", reason: "premium-active" });
  });

  it("blocks active Premium from starting Basic checkout (manage billing)", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly")).toMatchObject({
      action: "manage",
      reason: "premium-active",
    });
  });

  it("treats legacy Basic as Basic for rebuy protection", () => {
    const member = memberWithPlans([
      {
        planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly")).toMatchObject({
      action: "manage",
      reason: "basic-rebuy",
    });
  });

  it("allows beta-only members to subscribe to a paid plan", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.beta.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveMembershipCheckoutDecision(member, "basicMonthly").action).toBe("allow");
  });
});
