import { describe, expect, it } from "vitest";
import {
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";
import { PATTERN_BUILDER_LIFETIME_PURCHASES } from "../../config/patternBuilderLifetime";
import { testAccess } from "./patternAccessTestFixtures";
import {
  resolveSleevelessNewPatternUpgradeUiMode,
  shouldBypassSleevelessNewPatternUpgradeScreen,
  sleevelessLifetimeCheckoutPriceId,
} from "./sleevelessNewPatternUpgrade";

describe("shouldBypassSleevelessNewPatternUpgradeScreen", () => {
  it("bypasses for active Beta members", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: true,
      activePlanIds: [MEMBERSHIPS.beta.memberstackPlanId],
      freeClaimed: true,
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(access, "sleeveless")).toBe(true);
  });

  it("does not bypass for the removed annual Basic plan", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [REMOVED_BASIC_MEMBERSHIP_PLAN_ID],
      freeClaimed: true,
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(access, "sleeveless")).toBe(false);
  });

  it("bypasses for active remaining legacy monthly Basic members", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: true,
      activePlanIds: [LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId],
      freeClaimed: true,
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(access, "sleeveless")).toBe(true);
  });

  it("bypasses for active paid members", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: true,
      activePlanIds: [MEMBERSHIPS.membership.memberstackPlanId],
      freeClaimed: true,
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(access, "sleeveless")).toBe(true);
  });

  it("bypasses for Sleeveless lifetime owners without membership", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: true,
      activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId],
      freeClaimed: true,
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(access, "sleeveless")).toBe(true);
  });

  it("does not bypass Drop Shoulder lifetime owners for Sleeveless", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: true,
      activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.dropShoulder.memberstackPlanId],
      freeClaimed: true,
      claimedSystem: "sleeveless",
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(access, "sleeveless")).toBe(false);
  });

  it("allows logged-in no-plan users with unused free claim through existing free path", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [],
      freeClaimed: false,
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(access, "sleeveless")).toBe(true);
  });

  it("does not bypass logged-in no-plan users who already used their free Sleeveless pattern", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [],
      freeClaimed: true,
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(access, "sleeveless")).toBe(false);
  });

  it("still resolves normally when membership and lifetime ownership coexist", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: true,
      activePlanIds: [
        MEMBERSHIPS.membership.memberstackPlanId,
        PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId,
      ],
      freeClaimed: true,
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(access, "sleeveless")).toBe(true);
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(access, "drop-shoulder")).toBe(true);
  });
});

describe("resolveSleevelessNewPatternUpgradeUiMode", () => {
  it("shows membership and lifetime options for a claimed free Sleeveless user", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [],
      freeClaimed: true,
    });
    expect(resolveSleevelessNewPatternUpgradeUiMode(access, "sleeveless")).toBe(
      "membership-and-lifetime",
    );
  });

  it("shows membership and lifetime options for a claimed free Drop Shoulder user", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [],
      freeClaimed: true,
      claimedSystem: "drop-shoulder",
    });
    expect(resolveSleevelessNewPatternUpgradeUiMode(access, "drop-shoulder")).toBe(
      "membership-and-lifetime",
    );
  });
});

describe("sleevelessLifetimeCheckoutPriceId", () => {
  it("uses the centralized Memberstack price id", () => {
    expect(sleevelessLifetimeCheckoutPriceId()).toBe(
      PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPriceId,
    );
    expect(sleevelessLifetimeCheckoutPriceId()).not.toBe(
      PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.stripeProductId,
    );
  });
});
