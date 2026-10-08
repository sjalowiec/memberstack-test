import { describe, expect, it } from "vitest";
import { resolveAccountMyPatternsSystem } from "./accountMyPatternsList";
import {
  getContinueEditingHref,
  getOpenPatternHrefForProject,
  getSavedCustomPatternOpenHref,
  SIDEWAYS_CARDIGAN_OPEN_PATTERN_HREF,
  SIDEWAYS_CARDIGAN_SUMMARY_EDIT_HREF,
} from "./customPatternProjectNavigation";
import { resolvePatternSystemForSavePayload } from "./customPatternProjectClient";
import {
  patternSystemDisplayName,
  resolvePatternSystemFromProject,
} from "./patternSystemId";
import {
  buildCustomPatternProjectDrawerLines,
  formatCustomPatternProjectType,
} from "./patternWorkspaceLibraryDrawer";
import { withSidewaysCardiganConstructionAuthored } from "./sidewaysCardiganConstructionIdentity";
import type { SleevelessPatternRecord } from "./patternStorage";

function sidewaysPattern(title = "new Women's Sideways V-Neck"): SleevelessPatternRecord {
  return {
    id: "draft-sw",
    style: withSidewaysCardiganConstructionAuthored({ patternMode: "express" }, "cuff-up", "cardigan"),
    patternProject: { title, notes: "", titleCustomized: true },
  } as SleevelessPatternRecord;
}

function sleevelessPattern(): SleevelessPatternRecord {
  return {
    id: "draft-sl",
    style: { patternMode: "express", neckline: "round", garmentStyle: "pullover" },
    patternProject: { title: "Summer shell", notes: "", titleCustomized: true },
  } as SleevelessPatternRecord;
}

describe("saved Sideways pattern identity", () => {
  it("stores sideways-cardigan on a new save payload and keeps the custom title", () => {
    const pattern = sidewaysPattern();
    const payload = {
      name: "new Women's Sideways V-Neck",
      family: "sleeveless" as const,
      source: "express" as const,
      pattern,
      customOverrides: {},
    };
    expect(resolvePatternSystemForSavePayload(payload)).toBe("sideways-cardigan");
    expect(payload.pattern.style?.construction).toBe("sideways-cardigan");
    expect(payload.pattern.style?.constructionAuthored).toBe("sideways-cardigan");
    expect(payload.name).toBe("new Women's Sideways V-Neck");
    expect(patternSystemDisplayName("sideways-cardigan")).toBe("Sideways V-Neck");
  });

  it("labels My Patterns as Sideways V-Neck and does not group it as Sleeveless", () => {
    const summary = {
      id: "proj-sw",
      name: "new Women's Sideways V-Neck",
      family: "sleeveless" as const,
      source: "express" as const,
      patternSystem: "sideways-cardigan",
      updatedAt: "2026-09-24T15:00:00.000Z",
    };
    expect(formatCustomPatternProjectType(summary)).toBe("Sideways V-Neck");
    expect(buildCustomPatternProjectDrawerLines(summary).contextLine).toMatch(/^Sideways V-Neck • /);
    expect(resolveAccountMyPatternsSystem(summary)).toBe("sideways-cardigan");
    expect(resolveAccountMyPatternsSystem({ patternSystem: "sleeveless" })).toBe("sleeveless");
    expect(formatCustomPatternProjectType({
      id: "proj-sl",
      name: "Summer shell",
      family: "sleeveless",
      source: "express",
      patternSystem: "sleeveless",
    })).toBe("Sleeveless");
  });

  it("opens, edits, and copies as a Sideways pattern", () => {
    const project = {
      id: "proj-sw",
      pattern: sidewaysPattern(),
      customOverrides: {},
      source: "express" as const,
    };
    expect(resolvePatternSystemFromProject(project)).toBe("sideways-cardigan");
    expect(getOpenPatternHrefForProject(project)).toBe(SIDEWAYS_CARDIGAN_OPEN_PATTERN_HREF);
    expect(getOpenPatternHrefForProject(project)).toBe("/patterns/sideways-cardigan/pattern/");
    expect(getSavedCustomPatternOpenHref("express", project)).toContain(SIDEWAYS_CARDIGAN_SUMMARY_EDIT_HREF);
    expect(getSavedCustomPatternOpenHref("express", project)).toContain("project=proj-sw");
    expect(getContinueEditingHref("express", project)).toContain("/patterns/sideways-cardigan/summary/");
    expect(getOpenPatternHrefForProject(project)).not.toContain("/patterns/sleeveless/");

    const copyPayload = {
      name: "new Women's Sideways V-Neck - Copy",
      family: "sleeveless" as const,
      source: "express" as const,
      pattern: project.pattern,
      customOverrides: project.customOverrides,
    };
    expect(resolvePatternSystemForSavePayload(copyPayload)).toBe("sideways-cardigan");
    expect(copyPayload.name).not.toBe(project.pattern.patternProject?.title);
  });

  it("leaves an existing Sleeveless pattern on the Sleeveless routes", () => {
    const project = {
      pattern: sleevelessPattern(),
      customOverrides: {},
    };
    expect(resolvePatternSystemFromProject(project)).toBe("sleeveless");
    expect(getOpenPatternHrefForProject(project)).toBe("/patterns/sleeveless/pattern/");
    expect(getSavedCustomPatternOpenHref("express", project)).toBe(
      "/patterns/sleeveless/pattern/?edit=1",
    );
    expect(resolvePatternSystemForSavePayload({
      name: "Summer shell",
      pattern: project.pattern,
      customOverrides: {},
    })).toBe("sleeveless");
  });
});
