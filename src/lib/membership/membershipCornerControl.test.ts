import { describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_CORNER_CTA, resolveMembershipCornerCta } from "./membershipCornerCta";
import { performMembershipCornerAction } from "./membershipCornerControl";
import {
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";

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

describe("performMembershipCornerAction", () => {
  it("navigates to the Account page for Manage Membership (no direct Stripe portal)", async () => {
    const navigate = vi.fn();

    await expect(
      performMembershipCornerAction("manage", "/account#membership", { navigate }),
    ).resolves.toBe("navigate");

    expect(navigate).toHaveBeenCalledWith("/account#membership");
  });

  it("navigates for Become", async () => {
    const navigate = vi.fn();

    await expect(
      performMembershipCornerAction("become", "/membership", { navigate }),
    ).resolves.toBe("navigate");

    expect(navigate).toHaveBeenCalledWith("/membership");
  });

  it("falls back to the Become href when no href is provided", async () => {
    const navigate = vi.fn();

    await expect(
      performMembershipCornerAction("manage", "", { navigate }),
    ).resolves.toBe("navigate");

    expect(navigate).toHaveBeenCalledWith(MEMBERSHIP_CORNER_CTA.become.href);
  });
});

describe("resolveMembershipCornerCta (corner control contract)", () => {
  it("paid membership resolves to Manage Membership", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.manage);
  });

  it("removed annual Basic resolves to Become a Member", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });

  it("remaining legacy monthly Basic resolves to Manage Membership", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([
          { planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.manage);
  });

  it("free / logged-out keep Become a Member", () => {
    expect(resolveMembershipCornerCta({ data: null })).toEqual(MEMBERSHIP_CORNER_CTA.become);
    expect(resolveMembershipCornerCta(memberWithPlans([]))).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });
});
