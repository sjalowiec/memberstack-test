import { describe, expect, it } from "vitest";
import {
  isPatternSettingsEditBlockedForSystem,
  patternSystemSettingsEditBlockedMessage,
} from "./custom-pattern-projects-store.js";

describe("isPatternSettingsEditBlockedForSystem", () => {
  it("never blocks members", () => {
    expect(
      isPatternSettingsEditBlockedForSystem({
        hasSystemAccess: true,
        freeClaimedForSystem: true,
      }),
    ).toBe(false);
  });

  it("blocks when client reports the system is claimed for a free user", () => {
    expect(
      isPatternSettingsEditBlockedForSystem({
        hasSystemAccess: false,
        freeClaimedForSystem: true,
      }),
    ).toBe(true);
  });

  it("allows unclaimed free users", () => {
    expect(
      isPatternSettingsEditBlockedForSystem({
        hasSystemAccess: false,
        freeClaimedForSystem: false,
      }),
    ).toBe(false);
  });
});

describe("patternSystemSettingsEditBlockedMessage", () => {
  it("includes the pattern system display name", () => {
    expect(patternSystemSettingsEditBlockedMessage("drop-shoulder")).toMatch(/Drop Shoulder/i);
  });
});
