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
  it("grants access for membership, Beta, and remaining legacy Basic plan ids", () => {
    expect(
      hasMemberAccessFromActivePlanIds(activePlans(MEMBERSHIPS.membership.memberstackPlanId)),
    ).toBe(true);
    expect(hasMemberAccessFromActivePlanIds(activePlans(MEMBERSHIPS.beta.memberstackPlanId))).toBe(
      true,
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

describe("hasPatternBuilderAccess  global membership", () => {
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

  it("allows remaining legacy monthly Basic members to access both builders", () => {
    const planIds = activePlans(LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId);
    expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: planIds })).toBe(true);
    expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: planIds })).toBe(true);
  });

  it("allows Beta members to access both builders", () => {
    const planIds = activePlans(MEMBERSHIPS.beta.memberstackPlanId);
    expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: planIds })).toBe(true);
    expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: planIds })).toBe(true);
  });

  it("allows every configured global member plan id through the shared helper", () => {
    for (const planId of MEMBER_PLAN_IDS) {
      expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: [planId] })).toBe(
        true,
      );
      expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: [planId] })).toBe(
        true,
      );
    }
  });
});

describe("hasPatternBuilderAccess  lifetime builder ownership", () => {
  const sleevelessLifetimePlanId = PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId;
  const dropShoulderLifetimePlanId = PATTERN_BUILDER_LIFETIME_PURCHASES.dropShoulder.memberstackPlanId;
  const sleevelessLifetimePriceId = PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPriceId;

  it("allows Sleeveless lifetime owner to access Sleeveless only", () => {
    const planIds = activePlans(sleevelessLifetimePlanId);
    expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: planIds })).toBe(true);
    expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: planIds })).toBe(
      false,
    );
  });

  it("allows Drop Shoulder lifetime owner to access Drop Shoulder only", () => {
    const planIds = activePlans(dropShoulderLifetimePlanId);
    expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: planIds })).toBe(
      true,
    );
    expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: planIds })).toBe(false);
  });

  it("does not treat lifetime ownership as global membership", () => {
    expect(
      hasMemberAccessFromActivePlanIds(activePlans(sleevelessLifetimePlanId, dropShoulderLifetimePlanId)),
    ).toBe(false);
  });

  it("does not grant access from checkout price ids alone", () => {
    expect(
      hasPatternBuilderAccess({
        builder: "sleeveless",
        activePlanIds: activePlans(sleevelessLifetimePriceId),
      }),
    ).toBe(false);
  });
});

describe("hasPatternBuilderAccess  no paid access", () => {
  it("denies users with no membership and no lifetime plan", () => {
    expect(hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: [] })).toBe(false);
    expect(hasPatternBuilderAccess({ builder: "dropShoulder", activePlanIds: [] })).toBe(false);
    expect(
      hasPatternBuilderAccess({ builder: "sleeveless", activePlanIds: activePlans("pln_other") }),
    ).toBe(false);
  });

  it("fails safely for unknown builder keys", () => {
    expect(
      hasPatternBuilderAccess({
        builder: "raglan",
        activePlanIds: activePlans(MEMBERSHIPS.membership.memberstackPlanId),
      }),
    ).toBe(true);
    expect(
      hasPatternBuilderAccess({
        builder: "unknownBuilder",
        activePlanIds: activePlans(PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId),
      }),
    ).toBe(false);
  });
});

describe("hasLifetimePatternBuilderAccess", () => {
  it("matches only the configured plan id for each builder", () => {
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
  });
});
