import { describe, expect, it } from "vitest";
import {
  CUSTOM_BUILD_CONTINUE_EDITING_HREF,
  CUSTOM_BUILD_EDIT_WORKSPACE_HREF,
  CUSTOM_BUILD_FIRST_EDIT_HREF,
  EXPRESS_CONTINUE_EDITING_HREF,
  EXPRESS_EDIT_WORKSPACE_HREF,
  getContinueEditingHref,
  getSavedCustomPatternOpenHref,
  OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  OPEN_PATTERN_HREF,
  PATTERN_WORKSPACE_EDIT_QUERY,
  SAVED_CUSTOM_PATTERN_EDIT_CHOICES_QUERY,
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

  it("opens saved custom-build projects in the editable Foundation workspace (prefilled, not blank build/start)", () => {
    const href = getSavedCustomPatternOpenHref("custom-build");
    expect(href).toBe(CUSTOM_BUILD_EDIT_WORKSPACE_HREF);
    expect(href).toContain(CUSTOM_BUILD_FIRST_EDIT_HREF);
    expect(href).toContain(SAVED_CUSTOM_PATTERN_EDIT_CHOICES_QUERY);
    expect(href).not.toContain("/review");
    expect(href).not.toContain("/custom-style");
  });

  it("opens saved express projects in the pattern page's Edit Pattern Workspace (auto-opened), not the review page or step wizard", () => {
    const href = getSavedCustomPatternOpenHref("express");
    expect(href).toBe(OPEN_PATTERN_EDIT_WORKSPACE_HREF);
    expect(href).toBe(`${OPEN_PATTERN_HREF}?${PATTERN_WORKSPACE_EDIT_QUERY}`);
    expect(href).toContain(OPEN_PATTERN_HREF);
    // The in-place workspace is the edit surface; the step-by-step wizard is reached from inside
    // it, and the standalone review page is no longer the Edit landing page.
    expect(href).not.toBe(EXPRESS_CONTINUE_EDITING_HREF);
    expect(href).not.toBe(EXPRESS_EDIT_WORKSPACE_HREF);
    expect(href).not.toContain(SAVED_CUSTOM_PATTERN_EDIT_CHOICES_QUERY);
  });
});
