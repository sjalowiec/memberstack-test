import { describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_CORNER_CTA, resolveMembershipCornerCta } from "./membershipCornerCta";
import { performMembershipCornerAction } from "./membershipCornerControl";
import { MEMBERSHIPS } from "../../config/memberships";

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
  it("opens the Stripe portal for Manage Membership and does not navigate", async () => {
    const openPortal = vi.fn().mockResolvedValue(true);
    const navigate = vi.fn();

    await expect(
      performMembershipCornerAction("manage", "/account#membership", {
        openPortal,
        navigate,
      }),
    ).resolves.toBe("portal");

    expect(openPortal).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("navigates for Upgrade / Become and does not open the portal", async () => {
    const openPortal = vi.fn();
    const navigate = vi.fn();

    await expect(
      performMembershipCornerAction("upgrade", "/membership", {
        openPortal,
        navigate,
      }),
    ).resolves.toBe("navigate");

    expect(navigate).toHaveBeenCalledWith("/membership");
    expect(openPortal).not.toHaveBeenCalled();
  });

  it("restores control opportunity when portal launch fails (caller re-enables)", async () => {
    const openPortal = vi.fn().mockResolvedValue(false);
    const navigate = vi.fn();

    await expect(
      performMembershipCornerAction("manage", "/account#membership", {
        openPortal,
        navigate,
      }),
    ).resolves.toBe("portal");

    expect(openPortal).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("resolveMembershipCornerCta (corner control contract)", () => {
  it("Premium resolves to Manage Membership", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: MEMBERSHIPS.premium.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.manage);
  });

  it("Basic keeps Upgrade to Premium", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: MEMBERSHIPS.basic.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.upgrade);
  });

  it("free / logged-out keep Become a Member", () => {
    expect(resolveMembershipCornerCta({ data: null })).toEqual(MEMBERSHIP_CORNER_CTA.become);
    expect(resolveMembershipCornerCta(memberWithPlans([]))).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });
});
