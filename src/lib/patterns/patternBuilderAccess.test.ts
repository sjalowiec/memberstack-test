import { describe, expect, it } from "vitest";
import {
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  MEMBER_PLAN_IDS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";
import { PATTERN_BUILDER_LIFETIME_PURCHASES } from "../../config/patternBuilderLifetime";
import {
  hasLifetimePatternBuilderAccess,
  hasMemberAccessFromActivePlanIds,
  hasPatternBuilderAccess,
} from "./patternBuilderAccess";

function activePlans(...planIds: string[]): string[] {
  return planIds;
}

describe("hasMemberAccessFromActivePlanIds", () => {
  it("grants access for membership and remaining legacy Basic plan ids; not retired Beta", () => {
    expect(
      hasMemberAccessFromActivePlanIds(activePlans(MEMBERSHIPS.membership.memberstackPlanId)),
    ).toBe(true);
    expect(hasMemberAccessFromActivePlanIds(activePlans(MEMBERSHIPS.beta.memberstackPlanId))).toBe(
      false,
    );
    expect(
      hasMemberAccessFromActivePlanIds(
        activePlans(LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId),
      ),
    ).toBe(true);
  });

  it("denies access for the removed annual Basic plan", () => {
    expect(
      hasMemberAccessFromActivePlanIds(activePlans(REMOVED_BASIC_MEMBERSHIP_PLAN_ID)),
    ).toBe(false);
  });

  it("still grants access for remaining legacy membership plan ids", () => {
    expect(
      hasMemberAccessFromActivePlanIds(
        activePlans(LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId),
      ),
    ).toBe(true);
    expect(
      hasMemberAccessFromActivePlanIds(
        activePlans(LEGACY_MEMBERSHIPS.grandfatheredAnnual.memberstackPlanId),
      ),
    ).toBe(true);
  });

  it("denies access when no qualifying plan is present", () => {
    expect(hasMemberAccessFromActivePlanIds([])).toBe(false);
    expect(hasMemberAccessFromActivePlanIds(activePlans("pln_unknown"))).toBe(false);
  });
});

describe("hasPatternBuilderAccess  active membership only", () => {
  it("allows active members to access both builders", () => {
    const planIds = activePlans(MEMBERSHIPS.membership.memberstackPlanId);
    expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: planIds })).toBe(true);
    expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: planIds })).toBe(true);
  });

  it("denies the removed annual Basic plan for both builders", () => {
    const planIds = activePlans(REMOVED_BASIC_MEMBERSHIP_PLAN_ID);
    expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: planIds })).toBe(false);
    expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: planIds })).toBe(
      false,
    );
  });

  it("denies retired Beta-only members for both builders", () => {
    const planIds = activePlans(MEMBERSHIPS.beta.memberstackPlanId);
    expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: planIds })).toBe(false);
    expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: planIds })).toBe(
      false,
    );
  });

  it("allows Beta plus paid membership via the paid plan", () => {
    const planIds = activePlans(
      MEMBERSHIPS.beta.memberstackPlanId,
      MEMBERSHIPS.membership.memberstackPlanId,
    );
    expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: planIds })).toBe(true);
    expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: planIds })).toBe(true);
  });

  it("allows every configured global member plan id", () => {
    for (const planId of MEMBER_PLAN_IDS) {
      expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: [planId] })).toBe(
        true,
      );
      expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: [planId] })).toBe(
        true,
      );
    }
  });

  it("does not grant access from lifetime builder plans alone", () => {
    const sleevelessLifetimePlanId = PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId;
    const dropShoulderLifetimePlanId =
      PATTERN_BUILDER_LIFETIME_PURCHASES.dropShoulder.memberstackPlanId;
    expect(
      hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: [sleevelessLifetimePlanId] }),
    ).toBe(false);
    expect(
      hasPatternBuilderAccess({
        builder: "dropShoulder",
        activePlanIds: [dropShoulderLifetimePlanId],
      }),
    ).toBe(false);
    expect(
      hasMemberAccessFromActivePlanIds(
        activePlans(sleevelessLifetimePlanId, dropShoulderLifetimePlanId),
      ),
    ).toBe(false);
  });

  it("denies users with no membership", () => {
    expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: [] })).toBe(false);
    expect(
      hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: activePlans("pln_other") }),
    ).toBe(false);
  });
});

describe("hasLifetimePatternBuilderAccess (ownership detection only)", () => {
  it("matches only the configured plan id for each builder and does not imply access", () => {
    expect(
      hasLifetimePatternBuilderAccess(
        "sleeveless",
        activePlans(PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId),
      ),
    ).toBe(true);
    expect(
      hasLifetimePatternBuilderAccess(
        "dropShoulder",
        activePlans(PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId),
      ),
    ).toBe(false);
    expect(
      hasPatternBuilderAccess({
        builder: "sleeveless",
        activePlanIds: activePlans(
          PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId,
        ),
      }),
    ).toBe(false);
  });
});
