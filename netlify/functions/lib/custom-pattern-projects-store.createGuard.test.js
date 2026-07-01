import { describe, expect, it } from "vitest";
import {
  isSleevelessPatternCreateBlocked,
  readSleevelessEntitlementFromSaveBody,
  SLEEVELESS_PATTERN_CREATE_BLOCKED_MESSAGE,
} from "./custom-pattern-projects-store.js";

describe("isSleevelessPatternCreateBlocked", () => {
  it("never blocks a user with system access", () => {
    expect(
      isSleevelessPatternCreateBlocked({
        hasSystemAccess: true,
        freeClaimed: true,
        existingProjectCount: 9,
      }),
    ).toBe(false);
  });

  it("allows the first saved pattern for a free unclaimed user", () => {
    expect(
      isSleevelessPatternCreateBlocked({
        hasSystemAccess: false,
        freeClaimed: false,
        existingProjectCount: 0,
      }),
    ).toBe(false);
  });

  it("blocks create/copy when the free allowance is already claimed", () => {
    expect(
      isSleevelessPatternCreateBlocked({
        hasSystemAccess: false,
        freeClaimed: true,
        existingProjectCount: 1,
      }),
    ).toBe(true);
  });

  it("blocks when entitlement is missing but the user already has saved projects", () => {
    expect(
      isSleevelessPatternCreateBlocked({
        existingProjectCount: 2,
      }),
    ).toBe(true);
  });

  it("exposes the explanatory message", () => {
    expect(SLEEVELESS_PATTERN_CREATE_BLOCKED_MESSAGE).toMatch(/free Sleeveless Pattern/i);
  });
});

describe("readSleevelessEntitlementFromSaveBody", () => {
  it("reads the client entitlement snapshot from the save body", () => {
    expect(
      readSleevelessEntitlementFromSaveBody({
        name: "Test",
        entitlement: {
          hasSystemAccess: false,
          freeClaimed: true,
          freeClaimedPatternId: "pat_1",
        },
      }),
    ).toEqual({
      hasSystemAccess: false,
      freeClaimed: true,
      freeClaimedPatternId: "pat_1",
    });
  });
});
