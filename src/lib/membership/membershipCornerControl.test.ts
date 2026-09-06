import { describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_CORNER_CTA, resolveMembershipCornerCta } from "./membershipCornerCta";
import {
  applyMembershipCornerCta,
  performMembershipCornerAction,
} from "./membershipCornerControl";
import {
  FREE_ACCESS_MEMBERSHIPS,
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
  it("active member: button hidden", () => {
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" }]),
      ),
    ).toBeNull();
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([
          { planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
    ).toBeNull();
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

  it("logged-in non-member: button shown", () => {
    expect(resolveMembershipCornerCta(memberWithPlans([]))).toEqual(MEMBERSHIP_CORNER_CTA.become);
    expect(
      resolveMembershipCornerCta(
        memberWithPlans([{ planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID, status: "ACTIVE" }]),
      ),
    ).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });

  it("logged-out visitor: button shown", () => {
    expect(resolveMembershipCornerCta({ data: null })).toEqual(MEMBERSHIP_CORNER_CTA.become);
  });
});

describe("applyMembershipCornerCta", () => {
  function fakeCta(): HTMLButtonElement {
    return {
      hidden: false,
      textContent: "Become a Member",
      dataset: {
        membershipCornerKind: "become",
        membershipCornerHref: "/membership",
      },
    } as unknown as HTMLButtonElement;
  }

  it("hides the button when the viewer has member access", () => {
    const cta = fakeCta();
    applyMembershipCornerCta(cta, null);
    expect(cta.hidden).toBe(true);
    expect(cta.textContent).toBe("");
    expect(cta.dataset.membershipCornerKind).toBeUndefined();
  });

  it("shows Become a Member for logged-out visitors and logged-in non-members", () => {
    const cta = fakeCta();
    cta.hidden = true;
    applyMembershipCornerCta(cta, MEMBERSHIP_CORNER_CTA.become);
    expect(cta.hidden).toBe(false);
    expect(cta.textContent).toBe("Become a Member");
    expect(cta.dataset.membershipCornerHref).toBe("/membership");
  });
});
