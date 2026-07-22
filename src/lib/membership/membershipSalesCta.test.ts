import { describe, expect, it } from "vitest";
import {
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";
import {
  MEMBERSHIP_SALES_CTA,
  resolveMembershipSalesCta,
} from "./membershipSalesCta";

function memberWithPlans(connections: Array<{ planId: string; status: string }>) {
  return {
    data: {
      id: "mem_sales",
      planConnections: connections,
    },
  };
}

describe("resolveMembershipSalesCta (main sales CTA)", () => {
  it("logged-out visitor → Choose a membership → #pricing (no auth)", () => {
    expect(resolveMembershipSalesCta({ data: null })).toEqual(MEMBERSHIP_SALES_CTA.choosePlan);
    expect(resolveMembershipSalesCta(null)).toEqual(MEMBERSHIP_SALES_CTA.choosePlan);
    expect(MEMBERSHIP_SALES_CTA.choosePlan.label).toBe("Choose a membership");
    expect(MEMBERSHIP_SALES_CTA.choosePlan.href).toBe("#pricing");
  });

  it("logged-in free user → Choose a membership → #pricing", () => {
    expect(resolveMembershipSalesCta(memberWithPlans([]))).toEqual(
      MEMBERSHIP_SALES_CTA.choosePlan,
    );
  });

  it("active paid member ? Manage Membership ? account", () => {
    expect(
      resolveMembershipSalesCta(
        memberWithPlans([
          { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
    ).toEqual(MEMBERSHIP_SALES_CTA.manage);
  });

  it("beta-only and canceled paid still choose a plan", () => {
    expect(
      resolveMembershipSalesCta(
        memberWithPlans([{ planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_SALES_CTA.choosePlan);

    expect(
      resolveMembershipSalesCta(
        memberWithPlans([
          { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "CANCELED" },
        ]),
      ),
    ).toEqual(MEMBERSHIP_SALES_CTA.choosePlan);
  });

  it("legacy active paid members manage; removed Basic still chooses a plan", () => {
    expect(
      resolveMembershipSalesCta(
        memberWithPlans([
          { planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
    ).toEqual(MEMBERSHIP_SALES_CTA.manage);

    expect(
      resolveMembershipSalesCta(
        memberWithPlans([{ planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_SALES_CTA.choosePlan);
  });
});
