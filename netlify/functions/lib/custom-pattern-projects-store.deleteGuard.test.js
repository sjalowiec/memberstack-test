import { describe, expect, it } from "vitest";
import {
  FREE_SLEEVELESS_PATTERN_DELETE_BLOCKED_MESSAGE,
  isFreeSleevelessPatternDeleteBlocked,
} from "./custom-pattern-projects-store.js";

describe("isFreeSleevelessPatternDeleteBlocked", () => {
  it("never blocks a claimed free pattern without system access", () => {
    expect(
      isFreeSleevelessPatternDeleteBlocked({
        hasSystemAccess: false,
        freeClaimed: true,
        freeClaimedPatternId: "pat_free",
        projectId: "pat_free",
        totalSavedCount: 1,
      }),
    ).toBe(false);
  });

  it("never blocks the last remaining pattern when the claimed id is unknown", () => {
    expect(
      isFreeSleevelessPatternDeleteBlocked({
        hasSystemAccess: false,
        freeClaimed: true,
        projectId: "only",
        totalSavedCount: 1,
      }),
    ).toBe(false);
  });

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

  it("retains the legacy explanatory message for reference", () => {
    expect(FREE_SLEEVELESS_PATTERN_DELETE_BLOCKED_MESSAGE).toMatch(/free Sleeveless Pattern/i);
  });
});
