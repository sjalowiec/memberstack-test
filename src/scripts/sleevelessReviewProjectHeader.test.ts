import { describe, expect, it } from "vitest";
import { canCustomizePattern } from "../lib/patterns/sleevelessPatternAccessGate";
import {
  readOnlyPatternTitleFromMeta,
  shouldShowReadOnlyProjectNotes,
} from "./sleevelessReviewProjectHeader";

describe("readOnlyPatternTitleFromMeta", () => {
  it("uses auto-generated title when present", () => {
    expect(
      readOnlyPatternTitleFromMeta({
        title: "Sleeveless Pullover - Women's Size 4 Round Neck",
      }),
    ).toBe("Sleeveless Pullover - Women's Size 4 Round Neck");
  });

  it("shows previously customized title read-only", () => {
    expect(readOnlyPatternTitleFromMeta({ title: "  Mom's birthday vest  " })).toBe(
      "Mom's birthday vest",
    );
  });

  it("falls back when title is empty", () => {
    expect(readOnlyPatternTitleFromMeta({ title: "" })).toBe("Sleeveless Sweater");
    expect(readOnlyPatternTitleFromMeta({ title: "   " })).toBe("Sleeveless Sweater");
  });
});

describe("shouldShowReadOnlyProjectNotes", () => {
  it("hides notes UI when there are no notes", () => {
    expect(shouldShowReadOnlyProjectNotes("")).toBe(false);
    expect(shouldShowReadOnlyProjectNotes("  \n  ")).toBe(false);
  });

  it("shows compact read-only notes when saved notes exist", () => {
    expect(shouldShowReadOnlyProjectNotes("Use cotton DK")).toBe(true);
    expect(shouldShowReadOnlyProjectNotes("  Line one\nLine two  ")).toBe(true);
  });
});

describe("review project header access (free vs member)", () => {
  it("member/advanced users can customize title and notes", () => {
    expect(canCustomizePattern(new URL("https://example.test/review?advanced=1"))).toBe(true);
    expect(canCustomizePattern(new URL("https://example.test/review?customize=1"))).toBe(true);
  });

  it("free/quick users cannot customize title and notes", () => {
    expect(canCustomizePattern(new URL("https://example.test/review?advanced=0"))).toBe(false);
    expect(canCustomizePattern(new URL("https://example.test/review?customize=0"))).toBe(false);
  });
});
