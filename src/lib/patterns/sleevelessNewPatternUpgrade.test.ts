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

  it("does not bypass lifetime-only owners without membership", () => {
    const sleevelessLifetime = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId],
      freeClaimed: true,
    });
    const dropLifetime = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.dropShoulder.memberstackPlanId],
      freeClaimed: true,
      claimedSystem: "sleeveless",
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(sleevelessLifetime, "sleeveless")).toBe(
      false,
    );
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(dropLifetime, "sleeveless")).toBe(false);
  });

  it("does not bypass logged-in users without entitlement (membership required)", () => {
    const unclaimed = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [],
      freeClaimed: false,
    });
    const claimed = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [],
      freeClaimed: true,
    });
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(unclaimed, "sleeveless")).toBe(false);
    expect(shouldBypassSleevelessNewPatternUpgradeScreen(claimed, "sleeveless")).toBe(false);
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
  it("shows membership-only options for non-members (lifetime is not an access path)", () => {
    const sleevelessClaimed = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [],
      freeClaimed: true,
    });
    const dropClaimed = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [],
      freeClaimed: true,
      claimedSystem: "drop-shoulder",
    });
    expect(resolveSleevelessNewPatternUpgradeUiMode(sleevelessClaimed, "sleeveless")).toBe(
      "membership-only",
    );
    expect(resolveSleevelessNewPatternUpgradeUiMode(dropClaimed, "drop-shoulder")).toBe(
      "membership-only",
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
