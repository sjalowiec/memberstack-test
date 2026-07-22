import { describe, expect, it } from "vitest";
import {
  countProjectsForPatternSystem,
  isPatternCreateBlockedForSystem,
  patternSystemCreateBlockedMessage,
} from "./custom-pattern-projects-store.js";

describe("isPatternCreateBlockedForSystem", () => {
  it("never blocks members with system access", () => {
    expect(
      isPatternCreateBlockedForSystem({
        hasSystemAccess: true,
        freeClaimedForSystem: true,
        existingProjectCountForSystem: 99,
      }),
    ).toBe(false);
  });

  it("blocks logged-in non-members even with unused historical free claim", () => {
    expect(
      isPatternCreateBlockedForSystem({
        hasSystemAccess: false,
        freeClaimedForSystem: false,
        existingProjectCountForSystem: 0,
      }),
    ).toBe(true);
  });

  it("blocks when client reports the system is already claimed", () => {
    expect(
      isPatternCreateBlockedForSystem({
        hasSystemAccess: false,
        freeClaimedForSystem: true,
        existingProjectCountForSystem: 0,
      }),
    ).toBe(true);
  });

  it("fails closed when entitlement snapshot is missing", () => {
    expect(isPatternCreateBlockedForSystem(null)).toBe(true);
    expect(isPatternCreateBlockedForSystem(undefined)).toBe(true);
    expect(isPatternCreateBlockedForSystem({})).toBe(true);
  });
});

describe("countProjectsForPatternSystem", () => {
  it("counts only matching patternSystem rows", () => {
    const summaries = [
      { id: "a", patternSystem: "sleeveless" },
      { id: "b", patternSystem: "drop-shoulder" },
      { id: "c", patternSystem: "sleeveless" },
    ];
    expect(countProjectsForPatternSystem(summaries, "sleeveless")).toBe(2);
    expect(countProjectsForPatternSystem(summaries, "drop-shoulder")).toBe(1);
  });
});

describe("patternSystemCreateBlockedMessage", () => {
  it("includes the pattern system display name and membership requirement", () => {
    expect(patternSystemCreateBlockedMessage("drop-shoulder")).toMatch(/Drop Shoulder/i);
    expect(patternSystemCreateBlockedMessage("sleeveless")).toMatch(/membership/i);
    expect(patternSystemCreateBlockedMessage("sleeveless")).not.toMatch(/free/i);
  });
});

/** @deprecated alias coverage */
describe("isSleevelessPatternCreateBlocked (legacy alias)", () => {
  it("delegates to per-system guard", async () => {
    const { isSleevelessPatternCreateBlocked } = await import("./custom-pattern-projects-store.js");
    expect(
      isSleevelessPatternCreateBlocked({
        hasSystemAccess: false,
        freeClaimed: true,
        existingProjectCount: 0,
      }),
    ).toBe(true);
  });
});
