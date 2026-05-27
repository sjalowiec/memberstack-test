import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import {
  buildCustomPatternEditingBannerCopy,
  getCustomPatternEditingBannerState,
  SLEEVELESS_WORKSPACE_CREATE_TAB_PATH,
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

describe("Create tab editing banner page wiring", () => {
  it("Create tab astro page mounts the editing banner host and script", () => {
    const src = readFileSync(CREATE_TAB_ASTRO, "utf8");
    expect(src).toContain("data-cb-editing-banner-host");
    expect(src).toContain("custom-pattern-editing-banner.css");
    expect(src).toContain("customPatternEditingBanner.ts");
    expect(src).toContain(SLEEVELESS_WORKSPACE_CREATE_TAB_PATH);
  });

  it("Pattern output page does not mount the editing banner host", () => {
    const src = readFileSync(PATTERN_OUTPUT_ASTRO, "utf8");
    expect(src).not.toContain("data-cb-editing-banner-host");
    expect(src).not.toContain("customPatternEditingBanner.ts");
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
