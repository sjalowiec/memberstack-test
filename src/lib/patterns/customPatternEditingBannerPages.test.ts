import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import {
  buildCustomPatternEditingBannerCopy,
  getCustomPatternEditingBannerState,
} from "./customPatternEditingBanner";
import { saveCurrentPattern } from "./patternStorage";

const SUES_PATTERN = "Sue's test pattern";
const CREATE_TAB_ASTRO = join(
  process.cwd(),
  "src/pages/patterns/sleeveless-express.astro",
);
const PATTERN_OUTPUT_ASTRO = join(
  process.cwd(),
  "src/pages/patterns/sleeveless/pattern/index.astro",
);
const FOUNDATION_DESIGN_ASTRO = join(
  process.cwd(),
  "src/pages/patterns/sleeveless/custom-build/design/index.astro",
);

describe("Create tab editing banner page wiring", () => {
  it("Create tab astro page mounts the editing banner host and script", () => {
    const src = readFileSync(CREATE_TAB_ASTRO, "utf8");
    expect(src).toContain("data-cb-editing-banner-host");
    expect(src).toContain("custom-pattern-editing-banner.css");
    expect(src).toContain("customPatternEditingBanner.ts");
  });

  it("Pattern output page does not mount the editing banner host", () => {
    const src = readFileSync(PATTERN_OUTPUT_ASTRO, "utf8");
    expect(src).not.toContain("data-cb-editing-banner-host");
    expect(src).not.toContain("customPatternEditingBanner.ts");
  });

  it("Foundation design page wires edit-workspace header hooks", () => {
    const src = readFileSync(FOUNDATION_DESIGN_ASTRO, "utf8");
    expect(src).toContain("data-cb-foundation-header");
    expect(src).toContain("data-cb-onboarding-only");
    expect(src).toContain("data-cb-editing-helper");
    expect(src).toContain("data-cb-editing-project-name");
    expect(src).toContain("custom-pattern-editing-banner.css");
  });

  it("Foundation design page marks the internal stepper for saved-edit hiding", () => {
    const src = readFileSync(FOUNDATION_DESIGN_ASTRO, "utf8");
    expect(src).toContain("data-cb-custom-build-stepper");
    const css = readFileSync(
      join(process.cwd(), "src/styles/custom-pattern-editing-banner.css"),
      "utf8",
    );
    expect(css).toContain("html.kbm-editing-saved-pattern [data-cb-custom-build-stepper]");
  });
});

describe("Create tab shows banner while editing a saved pattern", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("shows editing copy and action bar state when active project id is set", () => {
    writeActiveCustomPatternProjectId("proj-sue", SUES_PATTERN);
    saveCurrentPattern({
      patternProject: { title: SUES_PATTERN, notes: "", titleCustomized: true },
    });

    expect(getCustomPatternEditingBannerState()).toEqual({
      show: true,
      projectName: SUES_PATTERN,
    });

    const copy = buildCustomPatternEditingBannerCopy(SUES_PATTERN);
    expect(copy.title).toBe(`Editing saved pattern: ${SUES_PATTERN}`);
    expect(copy.body).toBe("Changes won't be saved until you click Save.");
  });
});
