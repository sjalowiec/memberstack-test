import { describe, expect, it } from "vitest";
import {
  FREE_SLEEVELESS_PATTERN_DELETE_BLOCKED_MESSAGE,
  isFreeSleevelessPatternDeleteBlocked,
} from "./custom-pattern-projects-store.js";

describe("isFreeSleevelessPatternDeleteBlocked", () => {
  it("never blocks a user with system access", () => {
    expect(
      isFreeSleevelessPatternDeleteBlocked({
        hasSystemAccess: true,
        freeClaimed: true,
        freeClaimedPatternId: "pat_1",
        projectId: "pat_1",
        totalSavedCount: 1,
      }),
    ).toBe(false);
  });

  it("never blocks when the allowance has not been claimed", () => {
    expect(
      isFreeSleevelessPatternDeleteBlocked({
        hasSystemAccess: false,
        freeClaimed: false,
        projectId: "pat_1",
        totalSavedCount: 1,
      }),
    ).toBe(false);
  });

  it("blocks deleting exactly the claimed pattern id", () => {
    expect(
      isFreeSleevelessPatternDeleteBlocked({
        hasSystemAccess: false,
        freeClaimed: true,
        freeClaimedPatternId: "pat_free",
        projectId: "pat_free",
        totalSavedCount: 9,
      }),
    ).toBe(true);
  });

  it("allows deleting a different pattern when the claimed id is known", () => {
    expect(
      isFreeSleevelessPatternDeleteBlocked({
        hasSystemAccess: false,
        freeClaimed: true,
        freeClaimedPatternId: "pat_free",
        projectId: "pat_other",
        totalSavedCount: 9,
      }),
    ).toBe(false);
  });

  it("fallback: blocks the last remaining pattern when the claimed id is unknown", () => {
    expect(
      isFreeSleevelessPatternDeleteBlocked({
        hasSystemAccess: false,
        freeClaimed: true,
        projectId: "only",
        totalSavedCount: 1,
      }),
    ).toBe(true);
  });

  it("fallback: allows deleting when more than one pattern remains and id is unknown", () => {
    expect(
      isFreeSleevelessPatternDeleteBlocked({
        hasSystemAccess: false,
        freeClaimed: true,
        projectId: "one-of-many",
        totalSavedCount: 4,
      }),
    ).toBe(false);
  });

  it("defaults to blocking when the count is not finite (unknown id)", () => {
    expect(
      isFreeSleevelessPatternDeleteBlocked({
        hasSystemAccess: false,
        freeClaimed: true,
        projectId: "only",
        totalSavedCount: Number.NaN,
      }),
    ).toBe(true);
  });

  it("exposes the explanatory message", () => {
    expect(FREE_SLEEVELESS_PATTERN_DELETE_BLOCKED_MESSAGE).toMatch(/free Sleeveless Pattern/i);
  });
});
