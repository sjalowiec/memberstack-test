import { describe, expect, it } from "vitest";
import {
  CUSTOM_BUILD_CONTINUE_EDITING_HREF,
  CUSTOM_BUILD_EDIT_WORKSPACE_HREF,
  CUSTOM_BUILD_FIRST_EDIT_HREF,
  DROP_SHOULDER_CONTINUE_EDITING_HREF,
  DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  DROP_SHOULDER_OPEN_PATTERN_HREF,
  EXPRESS_CONTINUE_EDITING_HREF,
  EXPRESS_EDIT_WORKSPACE_HREF,
  getContinueEditingHref,
  getOpenPatternHrefForProject,
  getSavedCustomPatternOpenHref,
  OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  OPEN_PATTERN_HREF,
  PATTERN_WORKSPACE_EDIT_QUERY,
  SAVED_CUSTOM_PATTERN_EDIT_CHOICES_QUERY,
  SLEEVELESS_PATTERN_WORKSPACE_GENERATED_HREF,
  DROP_SHOULDER_PATTERN_WORKSPACE_GENERATED_HREF,
  PATTERN_WORKSPACE_GENERATED_QUERY,
} from "./customPatternProjectNavigation";

describe("customPatternProjectNavigation", () => {
  it("defines open pattern href", () => {
    expect(OPEN_PATTERN_HREF).toBe("/patterns/sleeveless/pattern/");
  });

  it("defines generated workspace hrefs for builder completion", () => {
    expect(SLEEVELESS_PATTERN_WORKSPACE_GENERATED_HREF).toBe(
      "/patterns/sleeveless/pattern/?generated=1",
    );
    expect(DROP_SHOULDER_PATTERN_WORKSPACE_GENERATED_HREF).toBe(
      "/patterns/drop-shoulder/pattern/?generated=1",
    );
    expect(PATTERN_WORKSPACE_GENERATED_QUERY).toBe("generated=1");
  });

  it("routes express projects to the pattern workspace edit surface", () => {
    expect(getContinueEditingHref("express")).toBe(EXPRESS_CONTINUE_EDITING_HREF);
    expect(EXPRESS_CONTINUE_EDITING_HREF).toBe(OPEN_PATTERN_EDIT_WORKSPACE_HREF);
    expect(EXPRESS_CONTINUE_EDITING_HREF).toContain(PATTERN_WORKSPACE_EDIT_QUERY);
    expect(EXPRESS_CONTINUE_EDITING_HREF).not.toContain("/review");
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
    expect(href).toBe(EXPRESS_CONTINUE_EDITING_HREF);
    expect(href).toContain(OPEN_PATTERN_HREF);
    expect(href).not.toBe(EXPRESS_EDIT_WORKSPACE_HREF);
    expect(href).not.toContain(SAVED_CUSTOM_PATTERN_EDIT_CHOICES_QUERY);
    expect(href).not.toContain("/review");
  });

  it("opens saved drop-shoulder express projects on the drop-shoulder pattern workspace", () => {
    const project = {
      pattern: {
        style: {
          construction: "drop-shoulder",
          constructionAuthored: "drop-shoulder",
        },
      },
      customOverrides: { constructionFamily: "drop-shoulder" },
    };
    expect(getOpenPatternHrefForProject(project)).toBe(DROP_SHOULDER_OPEN_PATTERN_HREF);
    expect(getSavedCustomPatternOpenHref("express", project)).toBe(
      DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF,
    );
  });

  it("continues drop-shoulder express projects on the drop-shoulder edit workspace", () => {
    const project = {
      pattern: {
        style: {
          construction: "drop-shoulder",
          constructionAuthored: "drop-shoulder",
        },
      },
      customOverrides: { constructionFamily: "drop-shoulder" },
    };
    expect(getContinueEditingHref("express", project)).toBe(DROP_SHOULDER_CONTINUE_EDITING_HREF);
    expect(getContinueEditingHref("express", project)).not.toBe(EXPRESS_CONTINUE_EDITING_HREF);
    expect(DROP_SHOULDER_CONTINUE_EDITING_HREF).not.toContain("/review");
  });

  it("continues sleeveless express projects on the sleeveless edit workspace", () => {
    expect(getContinueEditingHref("express")).toBe(EXPRESS_CONTINUE_EDITING_HREF);
    expect(getContinueEditingHref("express")).not.toBe(DROP_SHOULDER_CONTINUE_EDITING_HREF);
    expect(EXPRESS_CONTINUE_EDITING_HREF).not.toContain("/review");
  });
});
