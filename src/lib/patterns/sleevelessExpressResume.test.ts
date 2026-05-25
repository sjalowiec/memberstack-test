import { describe, expect, it, vi } from "vitest";
import {
  EXPRESS_EDITING_FALLBACK_LABEL,
  getExpressEditingProjectLabel,
  hasExpressResumeProgress,
} from "./sleevelessExpressResume";

vi.mock("./sleevelessPatternProjectMeta", () => ({
  getPatternProjectMeta: vi.fn(),
}));

import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";

describe("hasExpressResumeProgress", () => {
  it("returns false for empty or legacy auto-pullover defaults", () => {
    expect(hasExpressResumeProgress({})).toBe(false);
    expect(hasExpressResumeProgress({ shape: "straight" })).toBe(false);
    expect(hasExpressResumeProgress({ shape: "straight", front: "closed", style: "straight-pullover" })).toBe(
      false,
    );
  });

  it("returns true when the knitter has started Express choices", () => {
    expect(hasExpressResumeProgress({ who: "women" })).toBe(true);
    expect(hasExpressResumeProgress({ selectedSize: "M" })).toBe(true);
    expect(hasExpressResumeProgress({ front: "open" })).toBe(true);
    expect(hasExpressResumeProgress({ neckline: "round" })).toBe(true);
    expect(hasExpressResumeProgress({ fit: "standard" })).toBe(true);
  });
});

describe("getExpressEditingProjectLabel", () => {
  it("returns the custom project title when set", () => {
    vi.mocked(getPatternProjectMeta).mockReturnValue({
      title: "Aubrey's Green Vest",
      notes: "",
      titleCustomized: true,
    });
    expect(getExpressEditingProjectLabel()).toBe("Aubrey's Green Vest");
  });

  it("falls back when there is no custom title", () => {
    vi.mocked(getPatternProjectMeta).mockReturnValue({
      title: "Sleeveless Pullover - Women's Size M Round",
      notes: "",
      titleCustomized: false,
    });
    expect(getExpressEditingProjectLabel()).toBe(EXPRESS_EDITING_FALLBACK_LABEL);

    vi.mocked(getPatternProjectMeta).mockReturnValue({ title: "", notes: "" });
    expect(getExpressEditingProjectLabel()).toBe(EXPRESS_EDITING_FALLBACK_LABEL);
  });
});
