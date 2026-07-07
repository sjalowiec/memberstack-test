import { describe, expect, it } from "vitest";
import {
  isPatternSettingsEditBlockedForSystem,
  isSavedPatternRenameAttempt,
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

  it("does not promise renaming (renaming requires membership)", () => {
    expect(patternSystemSettingsEditBlockedMessage("sleeveless")).not.toMatch(/rename/i);
  });
});

describe("isSavedPatternRenameAttempt", () => {
  it("detects a changed name/title as a rename", () => {
    expect(isSavedPatternRenameAttempt("Mom's vest", "Mom's pullover")).toBe(true);
  });

  it("treats an unchanged name as not a rename (e.g. notes-only update)", () => {
    expect(isSavedPatternRenameAttempt("Mom's vest", "Mom's vest")).toBe(false);
  });

  it("ignores surrounding whitespace and the 120-char cap when comparing", () => {
    expect(isSavedPatternRenameAttempt("Mom's vest", "  Mom's vest  ")).toBe(false);
    const longName = "x".repeat(200);
    const existing = "x".repeat(120);
    expect(isSavedPatternRenameAttempt(existing, longName)).toBe(false);
  });

  it("is not a rename when no usable new name is provided", () => {
    expect(isSavedPatternRenameAttempt("Mom's vest", "")).toBe(false);
    expect(isSavedPatternRenameAttempt("Mom's vest", "   ")).toBe(false);
    expect(isSavedPatternRenameAttempt("Mom's vest", undefined)).toBe(false);
    expect(isSavedPatternRenameAttempt("Mom's vest", null)).toBe(false);
    expect(isSavedPatternRenameAttempt("Mom's vest", 42)).toBe(false);
  });

  it("treats setting a name on a previously-unnamed project as a rename", () => {
    expect(isSavedPatternRenameAttempt("", "New name")).toBe(true);
    expect(isSavedPatternRenameAttempt(undefined, "New name")).toBe(true);
  });
});
