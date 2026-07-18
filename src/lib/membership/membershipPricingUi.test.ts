import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { resolveJoinCtaPresentation } from "./membershipPricingUi";

function memberWithPlans(connections: Array<{ planId: string; status: string }>) {
  return {
    data: {
      id: "mem_ui",
      planConnections: connections,
    },
  };
}

describe("resolveJoinCtaPresentation", () => {
  it("shows Join labels for free members", () => {
    const member = memberWithPlans([]);
    expect(resolveJoinCtaPresentation(member, "basicMonthly")).toMatchObject({
      label: "Join Basic",
      disabled: false,
    });
    expect(resolveJoinCtaPresentation(member, "premiumAnnual")).toMatchObject({
      label: "Join Premium",
      disabled: false,
    });
  });

  it("shows Current Plan on Basic and Upgrade to Premium for active Basic", () => {
    const member = memberWithPlans([
      { planId: MEMBERSHIPS.basic.memberstackPlanId, status: "ACTIVE" },
    ]);
    expect(resolveJoinCtaPresentation(member, "basicMonthly")).toEqual({
      kind: "current",
      label: "Current Plan",
      disabled: true,
    });
    expect(resolveJoinCtaPresentation(member, "premiumMonthly")).toEqual({
      kind: "upgrade-premium",
      label: "Upgrade to Premium",
      disabled: false,
    });
  });

  it("shows Current Plan on Premium and Switch to Basic for active Premium", () => {
    const member = memberWithPlans([
      { planId: MEMBERSHIPS.premium.memberstackPlanId, status: "ACTIVE" },
    ]);
    expect(resolveJoinCtaPresentation(member, "premiumAnnual")).toEqual({
      kind: "current",
      label: "Current Plan",
      disabled: true,
    });
    expect(resolveJoinCtaPresentation(member, "basicMonthly")).toEqual({
      kind: "switch-basic",
      label: "Switch to Basic",
      disabled: false,
    });
  });
});
