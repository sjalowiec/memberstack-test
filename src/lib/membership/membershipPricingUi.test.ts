import { describe, expect, it } from "vitest";
import {
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";
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
  it("shows Become a Member for free members on monthly and annual", () => {
    const member = memberWithPlans([]);
    expect(resolveJoinCtaPresentation(member, "monthly")).toEqual({
      kind: "join",
      label: "Become a Member",
      disabled: false,
    });
    expect(resolveJoinCtaPresentation(member, "annual")).toEqual({
      kind: "join",
      label: "Become a Member",
      disabled: false,
    });
  });

  it("shows Current Plan for active paid membership on both intervals", () => {
    const member = memberWithPlans([
      { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
    ]);
    expect(resolveJoinCtaPresentation(member, "monthly")).toEqual({
      kind: "current",
      label: "Current Plan",
      disabled: true,
    });
    expect(resolveJoinCtaPresentation(member, "annual")).toEqual({
      kind: "current",
      label: "Current Plan",
      disabled: true,
    });
  });

  it("shows Become a Member for the removed annual Basic plan", () => {
    const member = memberWithPlans([
      { planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID, status: "ACTIVE" },
    ]);
    expect(resolveJoinCtaPresentation(member, "monthly")).toEqual({
      kind: "join",
      label: "Become a Member",
      disabled: false,
    });
  });

  it("shows Current Plan for remaining legacy monthly Basic paid members", () => {
    const member = memberWithPlans([
      { planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId, status: "ACTIVE" },
    ]);
    expect(resolveJoinCtaPresentation(member, "monthly")).toEqual({
      kind: "current",
      label: "Current Plan",
      disabled: true,
    });
  });

  it("shows Become a Member for beta-only members", () => {
    const member = memberWithPlans([
      { planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" },
    ]);
    expect(resolveJoinCtaPresentation(member, "monthly")).toMatchObject({
      kind: "join",
      label: "Become a Member",
      disabled: false,
    });
  });

  it("shows Become a Member for unexpected/unknown plan ids", () => {
    const member = memberWithPlans([
      { planId: "pln_unknown_legacy_value", status: "ACTIVE" },
    ]);
    expect(resolveJoinCtaPresentation(member, "monthly")).toEqual({
      kind: "join",
      label: "Become a Member",
      disabled: false,
    });
  });

  it("shows Become a Member for expired paid membership", () => {
    const member = memberWithPlans([
      { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "EXPIRED" },
    ]);
    expect(resolveJoinCtaPresentation(member, "annual")).toEqual({
      kind: "join",
      label: "Become a Member",
      disabled: false,
    });
  });
});
