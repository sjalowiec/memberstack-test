import { describe, expect, it } from "vitest";

import {
  softTint,
  WHATS_NEW_BADGE_COLORS,
  WHATS_NEW_CATEGORY_ACCENTS,
  WHATS_NEW_COLUMN_ACCENTS,
  WHATS_NEW_PINWHEEL,
  whatsNewCategoryCardStyle,
  whatsNewThemeStyle,
} from "./palette";

describe("whatsNew palette", () => {
  it("maps categories to the approved pinwheel accents", () => {
    expect(WHATS_NEW_CATEGORY_ACCENTS.tool.accent).toBe(WHATS_NEW_PINWHEEL.blue);
    expect(WHATS_NEW_CATEGORY_ACCENTS.pattern.accent).toBe(WHATS_NEW_PINWHEEL.plum);
    expect(WHATS_NEW_CATEGORY_ACCENTS.resource.accent).toBe(WHATS_NEW_PINWHEEL.indigo);
    expect(WHATS_NEW_CATEGORY_ACCENTS.learning.accent).toBe(WHATS_NEW_PINWHEEL.orange);
    expect(WHATS_NEW_CATEGORY_ACCENTS.improvement.accent).toBe(WHATS_NEW_PINWHEEL.green);
  });

  it("maps board columns and badges to the approved pinwheel accents", () => {
    expect(WHATS_NEW_COLUMN_ACCENTS.just_added).toBe("#be352f");
    expect(WHATS_NEW_COLUMN_ACCENTS.worth_exploring).toBe("#325b5d");
    expect(WHATS_NEW_COLUMN_ACCENTS.in_the_pipeline).toBe("#de9643");
    expect(WHATS_NEW_BADGE_COLORS.newBackground).toBe("#8a1e1d");
    expect(WHATS_NEW_BADGE_COLORS.featuredBackground).toBe("#5c254b");
  });

  it("builds soft tints and CSS variable helpers from the shared palette", () => {
    expect(softTint("#2b4859")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(softTint("#2b4859")).not.toBe("#2b4859");
    expect(whatsNewCategoryCardStyle("tool")).toContain("--wn-accent: #2b4859");
    expect(whatsNewThemeStyle()).toContain("--wn-col-just-added: #be352f");
    expect(whatsNewThemeStyle()).toContain("--wn-badge-new-bg: #8a1e1d");
  });
});
