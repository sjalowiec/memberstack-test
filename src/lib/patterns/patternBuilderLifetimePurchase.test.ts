import { describe, expect, it, vi } from "vitest";
import { PATTERN_BUILDER_LIFETIME_PURCHASES } from "../../config/patternBuilderLifetime";
import { MEMBERSHIPS } from "../../config/memberships";
import {
  buildPatternBuilderLifetimeCheckoutReturnUrls,
  startPatternBuilderLifetimeCheckout,
} from "./patternBuilderLifetimeCheckout";
import { PATTERN_BUILDER_UPGRADE_CONFIGS } from "./patternBuilderUpgradeConfig";
import { testAccess } from "./patternAccessTestFixtures";
import {
  resolvePatternBuilderNewPatternUpgradeUiMode,
  shouldBypassPatternBuilderNewPatternUpgradeScreen,
} from "./patternBuilderNewPatternUpgrade";
import {
  processPatternBuilderPurchaseReturn,
  readPatternBuilderPurchaseReturn,
  stripPatternBuilderPurchaseReturnParams,
} from "./patternBuilderLifetimePurchaseReturn";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

describe("resolvePatternBuilderNewPatternUpgradeUiMode (Drop Shoulder)", () => {
  it("shows membership and lifetime cards when the Drop Shoulder free claim is used", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [],
      freeClaimed: true,
      claimedSystem: "drop-shoulder",
    });
    expect(resolvePatternBuilderNewPatternUpgradeUiMode(access, "drop-shoulder")).toBe(
      "membership-and-lifetime",
    );
  });
});

describe("shouldBypassPatternBuilderNewPatternUpgradeScreen (Drop Shoulder)", () => {
  it("bypasses for Beta, Basic, and Premium members", () => {
    for (const planId of [
      MEMBERSHIPS.beta.memberstackPlanId,
      MEMBERSHIPS.basic.memberstackPlanId,
      MEMBERSHIPS.premium.memberstackPlanId,
    ]) {
      const access = testAccess({
        loggedIn: true,
        hasSystemAccess: true,
        activePlanIds: [planId],
        freeClaimed: true,
        claimedSystem: "drop-shoulder",
      });
      expect(shouldBypassPatternBuilderNewPatternUpgradeScreen(access, "drop-shoulder")).toBe(true);
    }
  });

  it("bypasses for Drop Shoulder lifetime owners without membership", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: true,
      activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.dropShoulder.memberstackPlanId],
      freeClaimed: true,
      claimedSystem: "drop-shoulder",
    });
    expect(shouldBypassPatternBuilderNewPatternUpgradeScreen(access, "drop-shoulder")).toBe(true);
  });

  it("does not bypass Sleeveless lifetime owners for Drop Shoulder", () => {
    const access = testAccess({
      loggedIn: true,
      hasSystemAccess: true,
      activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId],
      freeClaimed: true,
      claimedSystem: "drop-shoulder",
    });
    expect(shouldBypassPatternBuilderNewPatternUpgradeScreen(access, "drop-shoulder")).toBe(false);
  });
});

describe("buildPatternBuilderLifetimeCheckoutReturnUrls (Drop Shoulder)", () => {
  it("uses the shared builder purchase return format", () => {
    const loc = {
      href: "https://knititnow.com/patterns/drop-shoulder/builder?foo=1",
    } as Location;

    const { successUrl, cancelUrl } = buildPatternBuilderLifetimeCheckoutReturnUrls(
      PATTERN_BUILDER_UPGRADE_CONFIGS["drop-shoulder"],
      loc,
    );
    expect(successUrl).toContain("new=1");
    expect(cancelUrl).toContain("new=1");
    expect(successUrl).toContain("builderPurchase=success");
    expect(successUrl).toContain("builder=dropShoulder");
    expect(cancelUrl).toContain("builderPurchase=canceled");
    expect(cancelUrl).toContain("builder=dropShoulder");
  });
});

describe("startPatternBuilderLifetimeCheckout (Drop Shoulder)", () => {
  it("starts checkout with the centralized Drop Shoulder Memberstack price id", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.com/drop-shoulder" },
    });
    const assignLocation = vi.fn();

    const result = await startPatternBuilderLifetimeCheckout("dropShoulder", {
      waitForMemberstack: async () =>
        ({
          getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_buyer" } }),
          purchasePlansWithCheckout,
        }) as unknown as NonNullable<Window["$memberstackDom"]>,
      getLocation: () =>
        ({
          href: "https://knititnow.com/patterns/drop-shoulder/builder?new=1",
        }) as Location,
      assignLocation,
    });

    expect(result.ok).toBe(true);
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: PATTERN_BUILDER_LIFETIME_PURCHASES.dropShoulder.memberstackPriceId,
        autoRedirect: false,
      }),
    );
    expect(purchasePlansWithCheckout.mock.calls[0]?.[0]?.priceId).not.toBe(
      PATTERN_BUILDER_LIFETIME_PURCHASES.dropShoulder.stripeProductId,
    );
    expect(assignLocation).toHaveBeenCalledWith("https://checkout.stripe.com/drop-shoulder");
  });

  it("fails safely for unknown builder configuration", async () => {
    const result = await startPatternBuilderLifetimeCheckout("unknownBuilder", {
      waitForMemberstack: async () =>
        ({
          getCurrentMember: vi.fn(),
          purchasePlansWithCheckout: vi.fn(),
        }) as unknown as NonNullable<Window["$memberstackDom"]>,
    });
    expect(result).toMatchObject({ ok: false, reason: "unknown-builder" });
  });
});

function dropShoulderLifetimeOwnerAccess(): SleevelessUserAccess {
  return {
    loggedIn: true,
    memberId: "ms_drop_lifetime",
    activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.dropShoulder.memberstackPlanId],
    hasSystemAccess: true,
    freeClaimsBySystem: { "drop-shoulder": { claimed: true, patternId: "pat_ds_1" } },
  };
}

describe("processPatternBuilderPurchaseReturn (Drop Shoulder)", () => {
  it("refreshes access and unlocks Drop Shoulder after a successful shared-format purchase", async () => {
    const invalidateCache = vi.fn();
    const resolveAccess = vi.fn().mockResolvedValue(dropShoulderLifetimeOwnerAccess());

    const result = await processPatternBuilderPurchaseReturn(
      new URL(
        "https://knititnow.com/patterns/drop-shoulder/builder?new=1&builderPurchase=success&builder=dropShoulder",
      ),
      { invalidateCache, resolveAccess },
    );

    expect(invalidateCache).toHaveBeenCalled();
    expect(resolveAccess).toHaveBeenCalled();
    expect(result).toMatchObject({ kind: "success", unlocked: true, builderKey: "dropShoulder" });
    expect(result.message).toMatch(/Drop Shoulder Sweater patterns/i);
  });

  it("does not unlock Sleeveless when only Drop Shoulder lifetime is purchased", async () => {
    const access = dropShoulderLifetimeOwnerAccess();
    const resolveAccess = vi.fn().mockResolvedValue(access);
    const { hasPatternSystemAccess } = await import("./sleevelessPatternSystemAccess");

    await processPatternBuilderPurchaseReturn(
      new URL(
        "https://knititnow.com/patterns/drop-shoulder/builder?builderPurchase=success&builder=dropShoulder",
      ),
      { invalidateCache: vi.fn(), resolveAccess },
    );

    expect(hasPatternSystemAccess(access, "drop-shoulder")).toBe(true);
    expect(hasPatternSystemAccess(access, "sleeveless")).toBe(false);
  });

  it("returns canceled without refreshing access", async () => {
    const resolveAccess = vi.fn();
    const result = await processPatternBuilderPurchaseReturn(
      new URL(
        "https://knititnow.com/patterns/drop-shoulder/builder?new=1&builderPurchase=canceled&builder=dropShoulder",
      ),
      { invalidateCache: vi.fn(), resolveAccess },
    );

    expect(result).toEqual({ kind: "canceled", builderKey: "dropShoulder", unlocked: false });
    expect(resolveAccess).not.toHaveBeenCalled();
  });

  it("fails safely for unknown builder return configuration", async () => {
    const result = await processPatternBuilderPurchaseReturn(
      new URL(
        "https://knititnow.com/patterns/drop-shoulder/builder?builderPurchase=success&builder=unknownBuilder",
      ),
    );
    expect(result.unlocked).toBe(false);
    expect(result.kind).toBe("failed");
  });
});

describe("readPatternBuilderPurchaseReturn compatibility", () => {
  it("still supports legacy Sleeveless success and cancel URLs", () => {
    expect(
      readPatternBuilderPurchaseReturn(
        new URL("https://knititnow.com/patterns/sleeveless-express?new=1&sleevelessLifetime=success"),
      ),
    ).toEqual({ builderKey: "sleeveless", kind: "success" });

    expect(
      stripPatternBuilderPurchaseReturnParams(
        new URL("https://knititnow.com/patterns/sleeveless-express?new=1&sleevelessLifetime=canceled"),
      ),
    ).toBe("/patterns/sleeveless-express?new=1");
  });
});
