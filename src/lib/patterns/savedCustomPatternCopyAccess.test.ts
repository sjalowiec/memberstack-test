import { describe, expect, it } from "vitest";
import {
  canCopySavedCustomPatternProject,
  SAVED_PATTERN_COPY_LOCKED_HELP_TEXT,
} from "./savedCustomPatternCopyAccess";

describe("canCopySavedCustomPatternProject", () => {
  it("enables copy for an active member", () => {
    expect(
      canCopySavedCustomPatternProject({ isActiveMember: true, isPaidOwner: false }),
    ).toBe(true);
  });

  it("enables copy for a paid owner of the pattern", () => {
    expect(
      canCopySavedCustomPatternProject({ isActiveMember: false, isPaidOwner: true }),
    ).toBe(true);
  });

  it("disables copy for a free / non-owner user", () => {
    expect(
      canCopySavedCustomPatternProject({ isActiveMember: false, isPaidOwner: false }),
    ).toBe(false);
  });

  it("exposes helper text explaining how to unlock copy", () => {
    expect(SAVED_PATTERN_COPY_LOCKED_HELP_TEXT).toMatch(/purchase this pattern or become a member/i);
  });
});
