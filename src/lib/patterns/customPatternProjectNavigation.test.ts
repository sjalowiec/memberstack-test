import { describe, expect, it } from "vitest";
import {
  CUSTOM_BUILD_CONTINUE_EDITING_HREF,
  CUSTOM_BUILD_FIRST_EDIT_HREF,
  EXPRESS_CONTINUE_EDITING_HREF,
  getContinueEditingHref,
  getSavedCustomPatternOpenHref,
  OPEN_PATTERN_HREF,
} from "./customPatternProjectNavigation";

describe("customPatternProjectNavigation", () => {
  it("defines open pattern href", () => {
    expect(OPEN_PATTERN_HREF).toBe("/patterns/sleeveless/pattern/");
  });

  it("routes express projects to unified review", () => {
    expect(getContinueEditingHref("express")).toBe(EXPRESS_CONTINUE_EDITING_HREF);
    expect(EXPRESS_CONTINUE_EDITING_HREF).toBe("/patterns/sleeveless/review/");
  });

  it("routes custom-build projects to design foundation step", () => {
    expect(getContinueEditingHref("custom-build")).toBe(CUSTOM_BUILD_CONTINUE_EDITING_HREF);
    expect(CUSTOM_BUILD_FIRST_EDIT_HREF).toBe("/patterns/sleeveless/custom-build/design");
  });

  it("opens saved custom-build projects on the first Edit tab, not Customize/review", () => {
    const href = getSavedCustomPatternOpenHref("custom-build");
    expect(href).toBe(CUSTOM_BUILD_FIRST_EDIT_HREF);
    expect(href).not.toBe(EXPRESS_CONTINUE_EDITING_HREF);
    expect(href).not.toContain("/review");
    expect(href).not.toContain("/custom-style");
  });

  it("opens saved express projects on the pattern output tab", () => {
    expect(getSavedCustomPatternOpenHref("express")).toBe(OPEN_PATTERN_HREF);
  });
});
