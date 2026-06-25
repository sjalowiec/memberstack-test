import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  DROP_SHOULDER_OPEN_PATTERN_HREF,
  getOpenPatternHrefForProject,
  getSavedCustomPatternOpenHref,
  OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  OPEN_PATTERN_HREF,
} from "./customPatternProjectNavigation";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { loadSavedCustomPatternProject } from "./loadSavedCustomPatternProject";
import {
  CONSTRUCTION_AUTHORED_KEY,
  CONSTRUCTION_FAMILY_OVERRIDE_KEY,
  DROP_SHOULDER_CONSTRUCTION,
  withDropShoulderConstructionAuthored,
} from "./patternConstructionIdentity";
import { saveCurrentPattern } from "./patternStorage";
import {
  buildDefaultSleevelessPatternTitle,
  DROP_SHOULDER_PATTERN_FAMILY_NAME,
  DROP_SHOULDER_PATTERN_ONLINE_HEADING_FALLBACK,
  getSleevelessPatternOnlineHeading,
  refreshAutoPatternProjectTitle,
  SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK,
} from "./sleevelessPatternProjectMeta";
import { stubLocalStorage } from "./test/stubLocalStorage";

const dropShoulderPatternWorkspaceAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);
const sleevelessPatternWorkspaceAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);

function dropShoulderSavedProject(
  overrides: Partial<CustomPatternProject> = {},
): CustomPatternProject {
  return {
    id: "proj-drop-shoulder",
    name: "Child's Drop Shoulder",
    family: "sleeveless",
    source: "express",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    version: 1,
    customOverrides: { [CONSTRUCTION_FAMILY_OVERRIDE_KEY]: DROP_SHOULDER_CONSTRUCTION },
    pattern: {
      id: "pattern-drop",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      style: withDropShoulderConstructionAuthored(
        {
          recipientCategory: "kids",
          bodyShape: "straight",
          frontStyle: "closed",
          garmentStyle: "pullover",
          neckline: "round",
          patternMode: "express",
        },
        "long",
      ),
      fit: { sizingChart: "kids", selectedSize: "2 yr", easeChoice: "standard" },
      yarnGauge: { gaugeStitchRaw: "20", gaugeRowRaw: "28" },
      measurements: {},
      machine: {},
      calculations: {},
      instructions: {},
      patternProject: { title: "", notes: "" },
    },
    ...overrides,
  };
}

const loadCustomPatternProjectMock = vi.fn();

vi.mock("./customPatternProjectClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./customPatternProjectClient")>();
  return {
    ...actual,
    loadCustomPatternProject: (...args: unknown[]) => loadCustomPatternProjectMock(...args),
  };
});

describe("drop-shoulder saved pattern reopen routing", () => {
  beforeEach(() => {
    stubLocalStorage();
    loadCustomPatternProjectMock.mockReset();
  });

  it("routes view/open to the drop-shoulder workspace, not sleeveless", async () => {
    const project = dropShoulderSavedProject();
    loadCustomPatternProjectMock.mockResolvedValue({ ok: true, project });

    const viewResult = await loadSavedCustomPatternProject(project.id, "view");
    expect(viewResult).toEqual({ ok: true, redirectHref: DROP_SHOULDER_OPEN_PATTERN_HREF });
    expect(viewResult.ok && viewResult.redirectHref).not.toContain("/patterns/sleeveless/pattern/");

    const openResult = await loadSavedCustomPatternProject(project.id, "open");
    expect(openResult).toEqual({
      ok: true,
      redirectHref: DROP_SHOULDER_OPEN_PATTERN_EDIT_WORKSPACE_HREF,
    });
    expect(openResult.ok && openResult.redirectHref).not.toContain("/patterns/sleeveless/pattern/");
  });

  it("keeps sleeveless saved projects on the sleeveless workspace", () => {
    const sleevelessProject: CustomPatternProject = {
      ...dropShoulderSavedProject(),
      customOverrides: {},
      pattern: {
        ...dropShoulderSavedProject().pattern,
        style: {
          recipientCategory: "misses",
          bodyShape: "straight",
          frontStyle: "closed",
          garmentStyle: "pullover",
          neckline: "round",
          patternMode: "express",
        },
      },
    };

    expect(getOpenPatternHrefForProject(sleevelessProject)).toBe(OPEN_PATTERN_HREF);
    expect(getSavedCustomPatternOpenHref("express", sleevelessProject)).toBe(
      OPEN_PATTERN_EDIT_WORKSPACE_HREF,
    );
  });

  it("uses Drop Shoulder auto-title and online heading fallback, not Sleeveless", () => {
    saveCurrentPattern({
      style: {
        construction: DROP_SHOULDER_CONSTRUCTION,
        [CONSTRUCTION_AUTHORED_KEY]: DROP_SHOULDER_CONSTRUCTION,
        garmentStyle: "pullover",
        neckline: "round",
      },
      fit: { sizingChart: "kids", selectedSize: "2 yr" },
    });

    expect(
      buildDefaultSleevelessPatternTitle(
        { chartAudience: "kids", neckline: "round", garmentStyle: "pullover", selectedSize: "2 yr" },
        DROP_SHOULDER_PATTERN_FAMILY_NAME,
      ),
    ).toBe("Drop Shoulder Pullover - Child's Size 2 yr Round Neck");

    const meta = refreshAutoPatternProjectTitle({
      chartAudience: "kids",
      neckline: "round",
      garmentStyle: "pullover",
      selectedSize: "2 yr",
    });
    expect(meta.title).toContain("Drop Shoulder");
    expect(meta.title).not.toContain("Sleeveless");

    expect(getSleevelessPatternOnlineHeading({ title: "", notes: "" })).toBe(
      DROP_SHOULDER_PATTERN_ONLINE_HEADING_FALLBACK,
    );
    expect(getSleevelessPatternOnlineHeading({ title: "", notes: "" })).not.toBe(
      SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK,
    );
  });

  it("drop-shoulder pattern workspace print branding says Drop Shoulder, not Sleeveless", () => {
    expect(dropShoulderPatternWorkspaceAstro).toContain("Drop Shoulder Sweater Pattern");
    expect(dropShoulderPatternWorkspaceAstro).toContain(
      "Created with the Knit It Now Drop Shoulder Pattern Builder",
    );
    expect(dropShoulderPatternWorkspaceAstro).toContain("KnitItNow.com/drop-shoulder");
    expect(dropShoulderPatternWorkspaceAstro).not.toContain("Sleeveless Pattern Builder");

    expect(sleevelessPatternWorkspaceAstro).toContain("Sleeveless Sweater Pattern");
    expect(sleevelessPatternWorkspaceAstro).toContain("Sleeveless Pattern Builder");
  });
});
