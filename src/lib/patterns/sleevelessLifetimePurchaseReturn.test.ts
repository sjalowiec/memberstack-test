import { describe, expect, it, vi } from "vitest";
import { PATTERN_BUILDER_LIFETIME_PURCHASES } from "../../config/patternBuilderLifetime";
import { MEMBERSHIPS } from "../../config/memberships";
import {
  processSleevelessLifetimePurchaseReturn,
  readSleevelessLifetimePurchaseReturnKind,
  stripSleevelessLifetimePurchaseReturnParams,
} from "./sleevelessLifetimePurchaseReturn";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";

function lifetimeOwnerAccess(): SleevelessUserAccess {
  return {
    loggedIn: true,
    memberId: "ms_lifetime",
    activePlanIds: [PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId],
    hasSystemAccess: false,
    freeClaimsBySystem: { sleeveless: { claimed: true, patternId: "pat_1" } },
  };
}

describe("readSleevelessLifetimePurchaseReturnKind", () => {
  it("detects success, cancel, and failure return states", () => {
    expect(
      readSleevelessLifetimePurchaseReturnKind(
        new URL("https://knititnow.com/patterns/sleeveless-express?new=1&sleevelessLifetime=success"),
      ),
    ).toBe("success");
    expect(
      readSleevelessLifetimePurchaseReturnKind(
        new URL("https://knititnow.com/patterns/sleeveless-express?new=1&sleevelessLifetime=canceled"),
      ),
    ).toBe("canceled");
    expect(
      readSleevelessLifetimePurchaseReturnKind(
        new URL("https://knititnow.com/patterns/sleeveless-express?new=1&checkoutError=1"),
      ),
    ).toBe("failed");
  });
});

describe("stripSleevelessLifetimePurchaseReturnParams", () => {
  it("removes checkout return params while preserving new-pattern intent", () => {
    const cleaned = stripSleevelessLifetimePurchaseReturnParams(
      new URL("https://knititnow.com/patterns/sleeveless-express?new=1&sleevelessLifetime=success"),
    );
    expect(cleaned).toBe("/patterns/sleeveless-express?new=1");
  });
});

describe("processSleevelessLifetimePurchaseReturn", () => {
  it("refreshes access but does not unlock Dynamic Patterns from lifetime purchase alone", async () => {
    const invalidateCache = vi.fn();
    const resolveAccess = vi.fn().mockResolvedValue(lifetimeOwnerAccess());

    const result = await processSleevelessLifetimePurchaseReturn(
      new URL("https://knititnow.com/patterns/sleeveless-express?new=1&sleevelessLifetime=success"),
      { invalidateCache, resolveAccess },
    );

    expect(invalidateCache).toHaveBeenCalled();
    expect(resolveAccess).toHaveBeenCalled();
    expect(result).toMatchObject({ kind: "failed", unlocked: false });
    expect(result.errorMessage).toBeTruthy();
  });

  it("does not grant pattern system access from Sleeveless lifetime alone", async () => {
    const access = lifetimeOwnerAccess();
    const resolveAccess = vi.fn().mockResolvedValue(access);
    const { hasPatternSystemAccess } = await import("./sleevelessPatternSystemAccess");

    await processSleevelessLifetimePurchaseReturn(
      new URL("https://knititnow.com/patterns/sleeveless-express?sleevelessLifetime=success"),
      { invalidateCache: vi.fn(), resolveAccess },
    );

    expect(hasPatternSystemAccess(access, "sleeveless")).toBe(false);
    expect(hasPatternSystemAccess(access, "drop-shoulder")).toBe(false);
  });

  it("leaves access unchanged when checkout is canceled", async () => {
    const resolveAccess = vi.fn();
    const result = await processSleevelessLifetimePurchaseReturn(
      new URL("https://knititnow.com/patterns/sleeveless-express?new=1&sleevelessLifetime=canceled"),
      { invalidateCache: vi.fn(), resolveAccess },
    );

    expect(result).toEqual({ kind: "canceled", builderKey: "sleeveless", unlocked: false });
    expect(resolveAccess).not.toHaveBeenCalled();
  });

  it("does not grant access when checkout succeeds but Sleeveless is still locked", async () => {
    const resolveAccess = vi.fn().mockResolvedValue({
      loggedIn: true,
      activePlanIds: [],
      hasSystemAccess: false,
      freeClaimsBySystem: { sleeveless: { claimed: true, patternId: "pat_1" } },
    } satisfies SleevelessUserAccess);

    const result = await processSleevelessLifetimePurchaseReturn(
      new URL("https://knititnow.com/patterns/sleeveless-express?sleevelessLifetime=success"),
      { invalidateCache: vi.fn(), resolveAccess },
    );

    expect(result.unlocked).toBe(false);
    expect(result.errorMessage).toMatch(/not active yet/i);
  });

  it("still resolves normally when membership and lifetime ownership coexist", async () => {
    const access: SleevelessUserAccess = {
      loggedIn: true,
      activePlanIds: [
        MEMBERSHIPS.membership.memberstackPlanId,
        PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPlanId,
      ],
      hasSystemAccess: true,
      freeClaimsBySystem: {},
    };
    const resolveAccess = vi.fn().mockResolvedValue(access);
    const { hasPatternSystemAccess } = await import("./sleevelessPatternSystemAccess");

    const result = await processSleevelessLifetimePurchaseReturn(
      new URL("https://knititnow.com/patterns/sleeveless-express?sleevelessLifetime=success"),
      { invalidateCache: vi.fn(), resolveAccess },
    );

    expect(result.unlocked).toBe(true);
    expect(hasPatternSystemAccess(access, "sleeveless")).toBe(true);
    expect(hasPatternSystemAccess(access, "drop-shoulder")).toBe(true);
  });
});
